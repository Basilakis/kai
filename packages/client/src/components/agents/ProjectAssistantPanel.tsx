import React from 'react';
import styled from '@emotion/styled';
import AgentChat from './AgentChat';
import agentService, { AgentType, AgentMessage } from '../../services/agentService';

interface Material {
  id: string;
  name: string;
  type: string;
  image: string;
  specs: {
    material: string;
    color: string;
    size: string;
    finish: string;
  };
  price?: {
    value: number;
    unit: string;
  };
}

interface Project {
  id: string;
  name: string;
  type: string;
  description: string;
  rooms: Room[];
  createdAt: Date;
  updatedAt: Date;
}

interface Room {
  id: string;
  name: string;
  area: number; // in sq ft
  materials: {
    materialId: string;
    purpose: string;
    quantity: number;
    notes?: string;
  }[];
}

/**
 * ProjectAssistantPanel component
 * 
 * Provides an interface for users to interact with the Project Assistant agent,
 * helping organize materials into projects, recommend materials, and calculate
 * quantities and costs.
 */
const ProjectAssistantPanel: React.FC = () => {
  // Project state
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = React.useState<string | null>(null);
  const [availableMaterials, setAvailableMaterials] = React.useState<Material[]>([]);
  const [selectedMaterials, setSelectedMaterials] = React.useState<{[key: string]: Material}>({});
  
  // Agent communication state
  const initialMessages: AgentMessage[] = [
    {
      id: 'welcome',
      content: "Hi there! I'm your Project Assistant. I can help you plan your renovation or construction project, organize materials by room, calculate quantities, and recommend suitable materials. How can I assist with your project today?",
      sender: 'agent' as const,
      timestamp: new Date()
    }
  ];
  
  // Track agent session and messages
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [agentMessages, setAgentMessages] = React.useState<AgentMessage[]>(initialMessages);
  
  // Load sample data on component mount
  React.useEffect(() => {
    // Load sample projects
    const sampleProjects: Project[] = [
      {
        id: 'project-1',
        name: 'Home Renovation 2023',
        type: 'Residential Renovation',
        description: 'Complete renovation of kitchen, master bathroom, and guest bathroom.',
        rooms: [
          {
            id: 'room-1',
            name: 'Kitchen',
            area: 240, // 15ft x 16ft
            materials: [
              { materialId: 'material-1', purpose: 'Floor', quantity: 240, notes: 'Open concept kitchen area' },
              { materialId: 'material-2', purpose: 'Backsplash', quantity: 30, notes: 'Behind range and sink' }
            ]
          },
          {
            id: 'room-2',
            name: 'Master Bathroom',
            area: 120, // 10ft x 12ft
            materials: [
              { materialId: 'material-3', purpose: 'Floor', quantity: 120, notes: 'Heated floor installation' },
              { materialId: 'material-4', purpose: 'Shower Wall', quantity: 75, notes: 'Large walk-in shower' }
            ]
          },
          {
            id: 'room-3',
            name: 'Guest Bathroom',
            area: 90, // 9ft x 10ft
            materials: [
              { materialId: 'material-3', purpose: 'Floor', quantity: 90, notes: 'Match master bathroom floor' },
              { materialId: 'material-5', purpose: 'Wall', quantity: 120, notes: 'Accent wall behind vanity' }
            ]
          }
        ],
        createdAt: new Date('2023-10-15'),
        updatedAt: new Date('2023-11-20')
      },
      {
        id: 'project-2',
        name: 'Basement Remodel',
        type: 'Residential Remodel',
        description: 'Converting unfinished basement to entertainment room and bathroom.',
        rooms: [
          {
            id: 'room-4',
            name: 'Entertainment Room',
            area: 400, // 20ft x 20ft
            materials: [
              { materialId: 'material-6', purpose: 'Floor', quantity: 400, notes: 'Luxury vinyl tile for warmth' }
            ]
          },
          {
            id: 'room-5',
            name: 'Basement Bathroom',
            area: 64, // 8ft x 8ft
            materials: [
              { materialId: 'material-7', purpose: 'Floor', quantity: 64, notes: 'Non-slip porcelain' },
              { materialId: 'material-8', purpose: 'Shower', quantity: 40, notes: 'Corner shower unit' }
            ]
          }
        ],
        createdAt: new Date('2023-09-01'),
        updatedAt: new Date('2023-09-15')
      }
    ];
    
    // Load sample materials
    const sampleMaterials: Material[] = [
      {
        id: 'material-1',
        name: 'Carrara Marble Tile',
        type: 'Natural Stone',
        image: '/images/materials/carrara-marble.jpg',
        specs: {
          material: 'Marble',
          color: 'White with Grey Veining',
          size: '12" x 24"',
          finish: 'Polished'
        },
        price: {
          value: 15.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-2',
        name: 'Subway Ceramic Tile',
        type: 'Ceramic',
        image: '/images/materials/subway-tile.jpg',
        specs: {
          material: 'Ceramic',
          color: 'White',
          size: '3" x 6"',
          finish: 'Glossy'
        },
        price: {
          value: 5.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-3',
        name: 'Hexagon Porcelain Tile',
        type: 'Porcelain',
        image: '/images/materials/hex-porcelain.jpg',
        specs: {
          material: 'Porcelain',
          color: 'Light Grey',
          size: '2" Hexagon',
          finish: 'Matte'
        },
        price: {
          value: 8.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-4',
        name: 'Large Format Porcelain',
        type: 'Porcelain',
        image: '/images/materials/large-porcelain.jpg',
        specs: {
          material: 'Porcelain',
          color: 'White Marble Look',
          size: '24" x 48"',
          finish: 'Matte'
        },
        price: {
          value: 12.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-5',
        name: 'Glass Mosaic Tile',
        type: 'Glass',
        image: '/images/materials/glass-mosaic.jpg',
        specs: {
          material: 'Glass',
          color: 'Blue/Green Mix',
          size: '1" x 1" Mosaic',
          finish: 'Glossy'
        },
        price: {
          value: 18.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-6',
        name: 'Luxury Vinyl Plank',
        type: 'Vinyl',
        image: '/images/materials/vinyl-plank.jpg',
        specs: {
          material: 'Vinyl',
          color: 'Oak Brown',
          size: '7" x 48"',
          finish: 'Textured'
        },
        price: {
          value: 6.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-7',
        name: 'Slate-Look Porcelain',
        type: 'Porcelain',
        image: '/images/materials/slate-porcelain.jpg',
        specs: {
          material: 'Porcelain',
          color: 'Charcoal',
          size: '12" x 24"',
          finish: 'Textured'
        },
        price: {
          value: 9.99,
          unit: 'sq ft'
        }
      },
      {
        id: 'material-8',
        name: 'Marble Mosaic',
        type: 'Natural Stone',
        image: '/images/materials/marble-mosaic.jpg',
        specs: {
          material: 'Marble',
          color: 'White/Grey',
          size: '1" x 1" Mosaic',
          finish: 'Honed'
        },
        price: {
          value: 21.99,
          unit: 'sq ft'
        }
      }
    ];
    
    // Create mapping of materials for quick access
    const materialMap: {[key: string]: Material} = {};
    sampleMaterials.forEach(material => {
      materialMap[material.id] = material;
    });
    
    setProjects(sampleProjects);
    setAvailableMaterials(sampleMaterials);
    setSelectedMaterials(materialMap);
    setSelectedProject(sampleProjects[0]?.id || null);
  }, []);
  
  // Get the currently selected project
  const currentProject = projects.find(p => p.id === selectedProject) || null;
  
  // Get the currently selected room
  const currentRoom = currentProject?.rooms.find(r => r.id === selectedRoom) || null;
  
  // Handle selecting a project
  const handleSelectProject = (projectId: string) => {
    setSelectedProject(projectId);
    setSelectedRoom(null);
  };
  
  // Handle selecting a room
  const handleSelectRoom = (roomId: string) => {
    setSelectedRoom(roomId);
  };
  
  // Calculate total cost for a room
  const calculateRoomCost = (room: Room): number => {
    return room.materials.reduce((total, material) => {
      const materialData = selectedMaterials[material.materialId];
      if (materialData?.price) {
        return total + (materialData.price.value * material.quantity);
      }
      return total;
    }, 0);
  };
  
  // Calculate total cost for a project
  const calculateProjectCost = (project: Project): number => {
    return project.rooms.reduce((total, room) => {
      return total + calculateRoomCost(room);
    }, 0);
  };
  
  // Initialize agent session
  React.useEffect(() => {
    let mounted = true;
    let currentSessionId: string | null = null;
    
    // Create agent session when component mounts
    const initSession = async () => {
      try {
        const newSessionId = await agentService.createSession(AgentType.PROJECT_ASSISTANT);
        
        // Only update state if component is still mounted
        if (mounted) {
          setSessionId(newSessionId);
          currentSessionId = newSessionId;
          
          // Get initial messages from the session if we don't have custom ones
          if (initialMessages.length === 0) {
            setAgentMessages(agentService.getMessages(newSessionId));
          }
        }
      } catch (error) {
        console.error('Error creating agent session:', error);
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

  // Handle user messages to the agent
  const handleUserMessage = async (message: string) => {
    // Check message for project-specific keywords to trigger UI interactions
    const lowercaseMessage = message.toLowerCase();
    
    // Handle project/room selection based on keywords
    if (lowercaseMessage.includes('kitchen') && projects.length > 0 && projects[0]) {
      const kitchenRoom = projects[0]?.rooms.find(r => r.name === 'Kitchen');
      if (kitchenRoom) {
        setSelectedProject(projects[0].id);
        setSelectedRoom(kitchenRoom.id);
      }
    } else if (lowercaseMessage.includes('bathroom') && projects.length > 0 && projects[0]) {
      const bathroomRoom = projects[0]?.rooms.find(r => r.name.includes('Bathroom'));
      if (bathroomRoom) {
        setSelectedProject(projects[0].id);
        setSelectedRoom(bathroomRoom.id);
      }
    } else if (lowercaseMessage.includes('basement') && projects.length > 1 && projects[1]) {
      setSelectedProject(projects[1].id);
    }
    
    // Send message to agent service
    if (sessionId) {
      await agentService.sendMessage(sessionId, message);
      
      // Update messages from the session
      const updatedMessages = agentService.getMessages(sessionId);
      setAgentMessages(updatedMessages);
    }
  };

  return (
    <PanelContainer>
      <ProjectSection>
        <SectionHeader>
          <SectionTitle>Project Management</SectionTitle>
          <SectionSubtitle>
            Organize your material selections by project and room
          </SectionSubtitle>
        </SectionHeader>
        
        <ProjectNav>
          <ProjectList>
            <ListTitle>Your Projects</ListTitle>
            {projects.map(project => (
              <ProjectItem 
                key={project.id}
                active={project.id === selectedProject}
                onClick={() => handleSelectProject(project.id)}
              >
                <ProjectName>{project.name}</ProjectName>
                <ProjectType>{project.type}</ProjectType>
                {project.id === selectedProject && (
                  <ProjectRooms>
                    {project.rooms.map(room => (
                      <RoomItem 
                        key={room.id}
                        active={room.id === selectedRoom}
                        onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                          (e as React.MouseEvent & { stopPropagation: () => void }).stopPropagation();
                          handleSelectRoom(room.id);
                        }}
                      >
                        <RoomName>{room.name}</RoomName>
                        <RoomArea>{room.area} sq ft</RoomArea>
                      </RoomItem>
                    ))}
                  </ProjectRooms>
                )}
              </ProjectItem>
            ))}
          </ProjectList>
        </ProjectNav>
        
        {currentProject && (
          <ProjectDetail>
            <DetailHeader>
              <div>
                <DetailTitle>{currentProject.name}</DetailTitle>
                <DetailType>{currentProject.type}</DetailType>
              </div>
              <ProjectCost>
                Est. Materials: ${calculateProjectCost(currentProject).toFixed(2)}
              </ProjectCost>
            </DetailHeader>
            
            <DetailDescription>{currentProject.description}</DetailDescription>
            
            {currentRoom ? (
              <RoomDetail>
                <RoomHeader>
                  <RoomTitle>{currentRoom.name}</RoomTitle>
                  <RoomInfo>{currentRoom.area} sq ft | Est. Cost: ${calculateRoomCost(currentRoom).toFixed(2)}</RoomInfo>
                </RoomHeader>
                
                <MaterialSelections>
                  <SelectionsTitle>Material Selections</SelectionsTitle>
                  {currentRoom.materials.map((selection, index) => {
                    const material = selectedMaterials[selection.materialId];
                    return material ? (
                      <MaterialSelection key={index}>
                        <SelectionPurpose>{selection.purpose}</SelectionPurpose>
                        <SelectionDetails>
                          <MaterialImage>
                            <MaterialImagePlaceholder>{material.name.charAt(0)}</MaterialImagePlaceholder>
                          </MaterialImage>
                          <SelectionInfo>
                            <MaterialName>{material.name}</MaterialName>
                            <MaterialSpecs>
                              {material.specs.color} • {material.specs.size} • {material.specs.finish}
                            </MaterialSpecs>
                            <MaterialQuantity>
                              {selection.quantity} {material.price?.unit} •&nbsp;
                              ${(selection.quantity * (material.price?.value || 0)).toFixed(2)}
                            </MaterialQuantity>
                            {selection.notes && (
                              <SelectionNotes>{selection.notes}</SelectionNotes>
                            )}
                          </SelectionInfo>
                        </SelectionDetails>
                      </MaterialSelection>
                    ) : null;
                  })}
                </MaterialSelections>
                
                <SuggestionsSection>
                  <SuggestionsTitle>Suggestions</SuggestionsTitle>
                  <SuggestionsText>
                    Ask the Project Assistant for recommendations on material selections, 
                    alternatives that might better fit your budget, or advice on 
                    coordinating materials across rooms.
                  </SuggestionsText>
                </SuggestionsSection>
              </RoomDetail>
            ) : (
              <ProjectOverview>
                <OverviewTitle>Project Overview</OverviewTitle>
                <OverviewStats>
                  <StatItem>
                    <StatLabel>Rooms</StatLabel>
                    <StatValue>{currentProject.rooms.length}</StatValue>
                  </StatItem>
                  <StatItem>
                    <StatLabel>Total Area</StatLabel>
                    <StatValue>
                      {currentProject.rooms.reduce((sum, room) => sum + room.area, 0)} sq ft
                    </StatValue>
                  </StatItem>
                  <StatItem>
                    <StatLabel>Materials</StatLabel>
                    <StatValue>
                      {new Set(currentProject.rooms.flatMap(r => r.materials.map(m => m.materialId))).size}
                    </StatValue>
                  </StatItem>
                </OverviewStats>
                
                <OverviewInstructions>
                  Select a room from the project list to view its material selections and details.
                </OverviewInstructions>
              </ProjectOverview>
            )}
          </ProjectDetail>
        )}
      </ProjectSection>
      
      <AgentSection>
        <AgentHeader>
          <AgentTitle>Project Assistant</AgentTitle>
          <AgentSubtitle>
            Ask for help with project planning, material selection, and calculations
          </AgentSubtitle>
        </AgentHeader>
        
        <AgentChatContainer>
          <AgentChat 
            agentId="project-assistant"
            agentName="Project Assistant"
            agentType={AgentType.PROJECT_ASSISTANT}
            initialMessages={agentMessages}
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

const ProjectSection = styled.div`
  flex: 3;
  min-width: 0;
  display: flex;
  flex-direction: column;
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

const ProjectNav = styled.div`
  margin-bottom: 1.5rem;
`;

const ProjectList = styled.div`
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
`;

const ListTitle = styled.div`
  font-size: 1.125rem;
  font-weight: 500;
  padding: 0.75rem 1rem;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
`;

interface ActiveProps {
  active?: boolean;
}

const ProjectItem = styled.div<ActiveProps>`
  padding: 1rem;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  background-color: ${(props: ActiveProps) => props.active ? '#f0f7ff' : 'white'};
  transition: background-color 0.2s ease;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background-color: ${(props: ActiveProps) => props.active ? '#f0f7ff' : '#f9f9f9'};
  }
`;

const ProjectName = styled.div`
  font-weight: 500;
  margin-bottom: 0.25rem;
`;

const ProjectType = styled.div`
  font-size: 0.875rem;
  color: #666;
`;

const ProjectRooms = styled.div`
  margin-top: 0.75rem;
  padding-left: 1rem;
  border-left: 2px solid #e0e0e0;
`;

const RoomItem = styled.div<ActiveProps>`
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
  border-radius: 4px;
  background-color: ${(props: ActiveProps) => props.active ? '#e6f0ff' : '#f5f5f5'};
  cursor: pointer;
  
  &:hover {
    background-color: ${(props: ActiveProps) => props.active ? '#e6f0ff' : '#efefef'};
  }
`;

const RoomName = styled.div`
  font-weight: 500;
  font-size: 0.9375rem;
`;

const RoomArea = styled.div`
  font-size: 0.8125rem;
  color: #666;
`;

const ProjectDetail = styled.div`
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
  flex: 1;
`;

const DetailHeader = styled.div`
  padding: 1.25rem;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const DetailTitle = styled.h3`
  font-size: 1.25rem;
  margin-bottom: 0.25rem;
`;

const DetailType = styled.div`
  font-size: 0.875rem;
  color: #666;
`;

const ProjectCost = styled.div`
  background-color: #4a90e2;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-weight: 500;
  font-size: 0.9375rem;
`;

const DetailDescription = styled.p`
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #eee;
`;

const ProjectOverview = styled.div`
  padding: 1.25rem;
`;

const OverviewTitle = styled.h4`
  font-size: 1.125rem;
  margin-bottom: 1rem;
`;

const OverviewStats = styled.div`
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatLabel = styled.div`
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.25rem;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 500;
  color: #333;
`;

const OverviewInstructions = styled.div`
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-size: 0.9375rem;
  color: #666;
  text-align: center;
`;

const RoomDetail = styled.div`
  padding: 1.25rem;
`;

const RoomHeader = styled.div`
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #eee;
`;

const RoomTitle = styled.h4`
  font-size: 1.125rem;
  margin-bottom: 0.25rem;
`;

const RoomInfo = styled.div`
  font-size: 0.875rem;
  color: #666;
`;

const MaterialSelections = styled.div`
  margin-bottom: 1.5rem;
`;

const SelectionsTitle = styled.h5`
  font-size: 1rem;
  margin-bottom: 1rem;
`;

const MaterialSelection = styled.div`
  margin-bottom: 1.25rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SelectionPurpose = styled.div`
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

const SelectionDetails = styled.div`
  display: flex;
  background-color: #f9f9f9;
  border-radius: 6px;
  overflow: hidden;
`;

const MaterialImage = styled.div`
  width: 80px;
  height: 80px;
  background-color: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MaterialImagePlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: bold;
  color: #666;
`;

const SelectionInfo = styled.div`
  flex: 1;
  padding: 0.75rem;
`;

const MaterialName = styled.div`
  font-weight: 500;
  margin-bottom: 0.25rem;
`;

const MaterialSpecs = styled.div`
  font-size: 0.8125rem;
  color: #666;
  margin-bottom: 0.25rem;
`;

const MaterialQuantity = styled.div`
  font-size: 0.875rem;
  color: #4a90e2;
  font-weight: 500;
`;

const SelectionNotes = styled.div`
  font-size: 0.8125rem;
  color: #777;
  font-style: italic;
  margin-top: 0.5rem;
`;

const SuggestionsSection = styled.div`
  background-color: #f5f7fa;
  border-radius: 6px;
  padding: 1rem;
  border-left: 3px solid #4a90e2;
`;

const SuggestionsTitle = styled.h5`
  font-size: 1rem;
  margin-bottom: 0.5rem;
  color: #4a90e2;
`;

const SuggestionsText = styled.p`
  font-size: 0.9375rem;
  color: #555;
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

export default ProjectAssistantPanel;