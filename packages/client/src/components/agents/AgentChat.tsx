import React, { useState, useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import agentService, { AgentType, AgentMessage } from '../../services/agentService';

export interface AgentChatProps {
  /** Agent ID to communicate with */
  agentId: string;
  /** Optional agent name to display */
  agentName?: string;
  /** Optional agent avatar URL */
  agentAvatar?: string;
  /** Optional user avatar URL */
  userAvatar?: string;
  /** Optional agent type (for styling and behavior) */
  agentType?: AgentType | string;
  /** Optional callback when a message is sent */
  onSend?: (message: string) => void;
  /** Optional initial messages */
  initialMessages?: AgentMessage[];
  /** Optional placeholder for input */
  placeholder?: string;
  /** Optional className for styling */
  className?: string;
}

/**
 * AgentChat Component
 * 
 * Provides a chat interface for interacting with crewAI agents in the KAI platform.
 * Uses the centralized agentService for communication with agents.
 */
export const AgentChat: React.FC<AgentChatProps> = ({
  agentId,
  agentName = 'Assistant',
  agentAvatar,
  userAvatar,
  agentType = AgentType.RECOGNITION,
  onSend,
  initialMessages = [],
  placeholder = 'Type your message...',
  className,
}) => {
  // State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [isRetrying, setIsRetrying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize session on component mount
  useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    
    // Create a new session with the agent service
    const initSession = async () => {
      try {
        setConnectionStatus('connecting');
        setError(null);
        
        // Map string types to enum if needed
        let mappedAgentType: AgentType;
        if (typeof agentType === 'string') {
          switch (agentType) {
            case 'recognition':
              mappedAgentType = AgentType.RECOGNITION;
              break;
            case 'material':
              mappedAgentType = AgentType.MATERIAL_EXPERT;
              break;
            case 'project':
              mappedAgentType = AgentType.PROJECT_ASSISTANT;
              break;
            default:
              mappedAgentType = AgentType.RECOGNITION;
          }
        } else {
          mappedAgentType = agentType;
        }
        
        const newSessionId = await agentService.createSession(mappedAgentType);
        
        // Only update state if component is still mounted
        if (mounted) {
          setSessionId(newSessionId);
          currentSessionId = newSessionId;
          setConnectionStatus('connected');
          
          // Get initial messages from the session
          if (initialMessages.length === 0) {
            setMessages(agentService.getMessages(newSessionId));
          }
          
          // Set up websocket listener for real-time updates
          agentService.onAgentMessage(newSessionId, (message) => {
            setMessages(prev => [...prev, message]);
            setIsTyping(false);
          });
        }
      } catch (error) {
        console.error('Error creating agent session:', error);
        if (mounted) {
          setConnectionStatus('disconnected');
          setError('Failed to connect to the agent service. Please try again.');
        }
      }
    };
    
    initSession();
    
    // Cleanup session on component unmount
    return () => {
      mounted = false;
      if (currentSessionId) {
        agentService.offAgentMessage(currentSessionId); // Remove listeners
        agentService.closeSession(currentSessionId).catch(err => 
          console.error('Error closing session:', err)
        );
      }
    };
  }, [agentType, initialMessages.length]);
  
  // Handle sending a message to the agent
  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId) return;
    
    // Create a temporary message ID
    const tempMessageId = `temp-${Date.now()}`;
    
    // Add user message to UI immediately
    const userMessage: AgentMessage = {
      id: tempMessageId,
      content: input,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setError(null);
    
    const inputText = input;
    setInput('');
    
    try {
      // Notify parent component
      if (onSend) {
        onSend(inputText);
      }
      
      // Send message to agent service
      await agentService.sendMessage(sessionId, inputText);
      
      // No need to update messages here as the websocket listener will handle it
    } catch (error) {
      console.error('Error sending message to agent:', error);
      setError('Failed to send message. Please try again.');
      setIsTyping(false);
    }
  };
  
  // Upload an image to the agent (for recognition agent)
  const uploadImage = async (file: File) => {
    if (!sessionId) return null;
    
    setIsTyping(true);
    setError(null);
    
    try {
      // Upload image to agent service
      const results = await agentService.processImage(sessionId, file);
      
      // Update messages from the session
      const updatedMessages = agentService.getMessages(sessionId);
      setMessages(updatedMessages);
      
      // Return first result image URL if available
      return results && results.length > 0 && results[0] ? results[0].image : null;
    } catch (error) {
      console.error('Error uploading image to agent:', error);
      setError('Failed to process image. Please try again with a different image.');
      return null;
    } finally {
      setIsTyping(false);
    }
  };
  
  // Retry connection to agent service
  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      // Close existing session if any
      if (sessionId) {
        await agentService.closeSession(sessionId);
      }
      
      // Clear messages and error
      setMessages(initialMessages);
      setError(null);
      setConnectionStatus('connecting');
      
      // Map string types to enum if needed
      let mappedAgentType: AgentType;
      if (typeof agentType === 'string') {
        switch (agentType) {
          case 'recognition':
            mappedAgentType = AgentType.RECOGNITION;
            break;
          case 'material':
            mappedAgentType = AgentType.MATERIAL_EXPERT;
            break;
          case 'project':
            mappedAgentType = AgentType.PROJECT_ASSISTANT;
            break;
          default:
            mappedAgentType = AgentType.RECOGNITION;
        }
      } else {
        mappedAgentType = agentType;
      }
      
      const newSessionId = await agentService.createSession(mappedAgentType);
      setSessionId(newSessionId);
      setConnectionStatus('connected');
      
      // Set up websocket listener
      agentService.onAgentMessage(newSessionId, (message) => {
        setMessages(prev => [...prev, message]);
        setIsTyping(false);
      });
    } catch (error) {
      console.error('Error retrying connection:', error);
      setConnectionStatus('disconnected');
      setError('Failed to connect to the agent service. Please try again later.');
    } finally {
      setIsRetrying(false);
    }
  };
  
  // Retry sending a failed message
  const handleRetryMessage = async (content: string) => {
    if (!sessionId) return;
    
    setIsTyping(true);
    setError(null);
    
    try {
      // Send message to agent service
      await agentService.sendMessage(sessionId, content);
    } catch (error) {
      console.error('Error resending message:', error);
      setError('Failed to send message. Please try again.');
      setIsTyping(false);
    }
  };
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, error]);
  
  // Get agent info based on type
  const getAgentInfo = () => {
    const defaultInfo = {
      name: agentName || 'Agent',
      description: 'AI Assistant',
      iconUrl: '/images/agents/default-agent.png'
    };
    
    // Handle both string literals and enum values
    const agentTypeValue = typeof agentType === 'string' ? agentType : 
                          (agentType === AgentType.RECOGNITION ? 'recognition' :
                           agentType === AgentType.MATERIAL_EXPERT ? 'material_expert' : 
                           agentType === AgentType.PROJECT_ASSISTANT ? 'project_assistant' : 'unknown');
    
    switch (agentTypeValue) {
      case 'recognition':
      case AgentType.RECOGNITION:
        return {
          name: 'Recognition Assistant',
          description: 'Helps identify materials from images',
          iconUrl: '/images/agents/recognition-agent.png'
        };
      case 'material_expert':
      case 'material':
      case AgentType.MATERIAL_EXPERT:
        return {
          name: 'Material Expert',
          description: 'Provides detailed information about materials',
          iconUrl: '/images/agents/material-expert-agent.png'
        };
      case 'project_assistant':
      case 'project':
      case AgentType.PROJECT_ASSISTANT:
        return {
          name: 'Project Assistant',
          description: 'Helps organize materials into projects',
          iconUrl: '/images/agents/project-assistant-agent.png'
        };
      default:
        return defaultInfo;
    }
  };
  
  const agentInfo = getAgentInfo();
  
  return (
    <ChatContainer className={className}>
      <ChatHeader agentType={agentType}>
        <HeaderContent>
          {agentAvatar && <AgentAvatar src={agentAvatar} alt={agentName} />}
          <HeaderInfo>
            <AgentName>{agentName || agentInfo.name}</AgentName>
            <ConnectionStatus status={connectionStatus}>
              {connectionStatus === 'connected' ? 'Online' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </ConnectionStatus>
          </HeaderInfo>
        </HeaderContent>
      </ChatHeader>
      
      <MessagesContainer>
        {messages.map(message => (
          <MessageBubble key={message.id} sender={message.sender}>
            {message.sender === 'agent' && agentAvatar && (
              <Avatar src={agentAvatar} alt={agentName || agentInfo.name} />
            )}
            {message.sender === 'user' && userAvatar && (
              <Avatar src={userAvatar} alt="You" />
            )}
            <MessageContent sender={message.sender}>
              {message.content}
            </MessageContent>
          </MessageBubble>
        ))}
        
        {isTyping && (
          <MessageBubble sender="agent">
            {agentAvatar && <Avatar src={agentAvatar} alt={agentName || agentInfo.name} />}
            <TypingIndicator>
              <Dot />
              <Dot />
              <Dot />
            </TypingIndicator>
          </MessageBubble>
        )}
        
        {error && (
          <ErrorContainer>
            <ErrorMessage>
              <ErrorIcon>⚠️</ErrorIcon>
              <ErrorText>{error}</ErrorText>
            </ErrorMessage>
            {connectionStatus === 'disconnected' && (
              <RetryButton 
                onClick={handleRetryConnection} 
                disabled={isRetrying}
              >
                {isRetrying ? 'Reconnecting...' : 'Retry Connection'}
              </RetryButton>
            )}
          </ErrorContainer>
        )}
        
        <div ref={messagesEndRef} />
      </MessagesContainer>
      
      <InputContainer>
        <Input 
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSendMessage()}
          placeholder={placeholder}
          disabled={connectionStatus !== 'connected' || isTyping}
        />
        <SendButton 
          onClick={handleSendMessage} 
          disabled={!input.trim() || connectionStatus !== 'connected' || isTyping}
        >
          {isTyping ? (
            <ButtonSpinner />
          ) : (
            'Send'
          )}
        </SendButton>
      </InputContainer>
    </ChatContainer>
  );
};

// Styled Components
const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 500px;
  width: 100%;
  max-width: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: #f9f9f9;
  
  @media (max-width: 768px) {
    max-width: 100%;
    height: 450px;
  }
  
  @media (max-width: 480px) {
    height: 400px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }
`;

const ChatHeader = styled.div<{ agentType: string | AgentType }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background-color: ${(props: { agentType: string | AgentType }) => {
    // Handle both string literals and enum values
    const agentTypeValue = typeof props.agentType === 'string' ? props.agentType : 
                          (props.agentType === AgentType.RECOGNITION ? 'recognition' :
                           props.agentType === AgentType.MATERIAL_EXPERT ? 'material' : 
                           props.agentType === AgentType.PROJECT_ASSISTANT ? 'project' : 'unknown');
                           
    switch (agentTypeValue) {
      case 'recognition': return '#4a6fa5';
      case 'material': return '#5d8b5e';
      case 'project': return '#9c6b44';
      default: return '#4a6fa5';
    }
  }};
  color: white;
`;

const HeaderContent = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
`;

const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

const ConnectionStatus = styled.div<{ status: 'connected' | 'connecting' | 'disconnected' }>`
  font-size: 12px;
  color: ${(props: { status: 'connected' | 'connecting' | 'disconnected' }) => {
    switch (props.status) {
      case 'connected': return '#8eff8e';
      case 'connecting': return '#ffdd8e';
      case 'disconnected': return '#ff8e8e';
      default: return 'white';
    }
  }};
`;

const AgentAvatar = styled.img`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  margin-right: 8px;
  object-fit: cover;
`;

const AgentName = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`;

const MessagesContainer = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  
  /* Add scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
`;

const MessageBubble = styled.div<{ sender: string }>`
  display: flex;
  margin-bottom: 12px;
  align-items: flex-start;
  justify-content: ${(props: { sender: string }) => props.sender === 'user' ? 'flex-end' : 'flex-start'};
  
  @media (max-width: 480px) {
    margin-bottom: 8px;
  }
`;

const Avatar = styled.img`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  margin-right: 8px;
  object-fit: cover;
  
  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
  }
`;

const MessageContent = styled.div<{ sender: string }>`
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 18px;
  background-color: ${(props: { sender: string }) => props.sender === 'user' ? '#0084ff' : '#e9e9eb'};
  color: ${(props: { sender: string }) => props.sender === 'user' ? 'white' : '#333'};
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word;
  
  @media (max-width: 480px) {
    max-width: 80%;
    padding: 8px 12px;
    font-size: 13px;
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9e9eb;
  padding: 10px 14px;
  border-radius: 18px;
  
  @media (max-width: 480px) {
    padding: 8px 12px;
  }
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #999;
  margin: 0 2px;
  animation: bounce 1.4s infinite ease-in-out;
  animation-fill-mode: both;
  
  &:nth-child(1) {
    animation-delay: -0.32s;
  }
  
  &:nth-child(2) {
    animation-delay: -0.16s;
  }
  
  @keyframes bounce {
    0%, 80%, 100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
  
  @media (max-width: 480px) {
    width: 6px;
    height: 6px;
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 12px 0;
  width: 100%;
`;

const ErrorMessage = styled.div`
  display: flex;
  align-items: center;
  background-color: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 13px;
  max-width: 90%;
  margin-bottom: 8px;
`;

const ErrorIcon = styled.span`
  margin-right: 8px;
`;

const ErrorText = styled.span`
  flex: 1;
`;

const RetryButton = styled.button`
  background-color: #ff3b30;
  color: white;
  border: none;
  border-radius: 16px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
    background-color: #e0352c;
  }
  
  &:disabled {
    background-color: #ffaba7;
    cursor: not-allowed;
  }
`;

const InputContainer = styled.div`
  display: flex;
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
  
  @media (max-width: 480px) {
    padding: 10px;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #0084ff;
  }
  
  &:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
  
  @media (max-width: 480px) {
    padding: 8px 12px;
    font-size: 13px;
  }
`;

const SendButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
  background-color: #0084ff;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 10px 16px;
  margin-left: 8px;
  font-size: 14px;
  cursor: pointer;
  outline: none;
  transition: background-color 0.2s;
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
  
  &:hover:not(:disabled) {
    background-color: #0077e6;
  }
  
  @media (max-width: 480px) {
    min-width: 48px;
    padding: 8px 12px;
    font-size: 13px;
  }
`;

// Spinner for loading states
const spin = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ButtonSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s linear infinite;
  
  ${spin}
  
  @media (max-width: 480px) {
    width: 14px;
    height: 14px;
  }
`;

export default AgentChat;