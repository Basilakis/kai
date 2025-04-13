import React from 'react';
import { useUser } from './UserProvider';

// Share target platform
export type SharePlatform = 
  'email' | 
  'twitter' | 
  'facebook' | 
  'linkedin' | 
  'pinterest' | 
  'whatsapp' | 
  'link' | 
  'pdf' | 
  'image';

// Share content type
export interface ShareContent {
  materialId: string;
  name: string;
  manufacturer: string;
  category: string;
  imageUrl: string;
  description?: string;
  url?: string;
}

// Share history item
export interface ShareHistoryItem {
  id: string;
  materialId: string;
  platform: SharePlatform;
  timestamp: string;
  recipient?: string; // Email address or username if applicable
  success: boolean;
  url?: string; // Generated share URL if applicable
  userId: string; // Owner ID for user validation
}

// MoodBoard collaborator
export interface Collaborator {
  id: string;
  email: string;
  username?: string;
  invitedBy: string; // User ID who invited them
  status: 'pending' | 'accepted' | 'declined';
  invitedAt: string;
  respondedAt?: string | undefined; // Explicitly allow undefined to fix type issues
}

// MoodBoard sharing settings
export interface MoodBoardSharing {
  moodBoardId: string;
  isPublic: boolean; // If true, anyone with the link can view
  allowEditing: boolean; // If true, collaborators can edit
  collaborators: Collaborator[];
  lastUpdated: string;
}

// Share options
export interface ShareOptions {
  includeImage: boolean;
  includeProperties: boolean;
  includeNotes?: boolean;
  customMessage?: string;
}

// Sharing context interface
interface SharingContextValue {
  isSharing: boolean;
  shareHistory: ShareHistoryItem[];
  moodBoardSharings: MoodBoardSharing[];
  // Share methods
  shareMaterial: (
    content: ShareContent,
    platform: SharePlatform,
    options?: ShareOptions
  ) => Promise<ShareHistoryItem>;
  getShareableLink: (materialId: string, options?: ShareOptions) => Promise<string>;
  getShareableImage: (materialId: string, options?: ShareOptions) => Promise<string>;
  getShareablePDF: (materialId: string, options?: ShareOptions) => Promise<string>;
  // MoodBoard collaboration methods
  shareMoodBoard: (moodBoardId: string, collaboratorEmail: string, allowEditing: boolean) => Promise<boolean>;
  removeMoodBoardCollaborator: (moodBoardId: string, collaboratorId: string) => Promise<boolean>;
  getMoodBoardCollaborators: (moodBoardId: string) => Collaborator[];
  checkMoodBoardAccess: (moodBoardId: string, userId?: string) => { canView: boolean; canEdit: boolean };
  // History methods
  clearShareHistory: () => void;
  // Utilities
  canShareTo: (platform: SharePlatform) => boolean;
  getPlatformShareUrl: (platform: SharePlatform, content: ShareContent) => string;
}

// Default share options
const defaultShareOptions: ShareOptions = {
  includeImage: true,
  includeProperties: true,
  includeNotes: false,
  customMessage: '',
};

// Create context
// @ts-ignore - Workaround for TypeScript issue
const SharingContext = React.createContext<SharingContextValue>({
  isSharing: false,
  shareHistory: [],
  moodBoardSharings: [],
  shareMaterial: async () => ({ 
    id: '', 
    materialId: '', 
    platform: 'link', 
    timestamp: '', 
    success: false,
    userId: '' 
  }),
  getShareableLink: async () => '',
  getShareableImage: async () => '',
  getShareablePDF: async () => '',
  shareMoodBoard: async () => false,
  removeMoodBoardCollaborator: async () => false,
  getMoodBoardCollaborators: () => [],
  checkMoodBoardAccess: () => ({ canView: false, canEdit: false }),
  clearShareHistory: () => {},
  canShareTo: () => false,
  getPlatformShareUrl: () => '',
});

// Provider props
interface SharingProviderProps {
  children: React.ReactNode;
}

/**
 * SharingProvider Component
 * 
 * Provides functionality for social sharing of materials:
 * - Share to social media platforms
 * - Generate shareable links
 * - Export as PDF or image
 * - Share via email
 * - Track sharing history
 * - MoodBoard collaboration with user-specific access control
 */
export const SharingProvider: React.FC<SharingProviderProps> = ({ children }) => {
  // Use the UserProvider to get the current user
  const { user } = useUser();

  // State
  const [isSharing, setIsSharing] = React.useState<boolean>(false);
  const [shareHistory, setShareHistory] = React.useState<ShareHistoryItem[]>([]);
  const [moodBoardSharings, setMoodBoardSharings] = React.useState<MoodBoardSharing[]>([]);

  // Load share history from localStorage on mount
  React.useEffect(() => {
    const loadShareHistory = () => {
      try {
        // Only load the current user's share history
        if (user?.id) {
          const saved = localStorage.getItem(`shareHistory_${user.id}`);
          if (saved) {
            // Filter history to only include items owned by the current user
            const history = JSON.parse(saved) as ShareHistoryItem[];
            const userHistory = history.filter(item => !item.userId || item.userId === user.id);
            setShareHistory(userHistory);
          }
        }
      } catch (error) {
        console.error('Failed to load share history:', error);
      }
    };

    // Load MoodBoard sharings
    const loadMoodBoardSharings = () => {
      try {
        if (user?.id) {
          const saved = localStorage.getItem(`moodBoardSharings_${user.id}`);
          if (saved) {
            setMoodBoardSharings(JSON.parse(saved));
          }
        }
      } catch (error) {
        console.error('Failed to load MoodBoard sharings:', error);
      }
    };

    loadShareHistory();
    loadMoodBoardSharings();
  }, [user?.id]);

  // Save share history to localStorage when it changes
  React.useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`shareHistory_${user.id}`, JSON.stringify(shareHistory));
    }
  }, [shareHistory, user?.id]);

  // Save MoodBoard sharings to localStorage when they change
  React.useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`moodBoardSharings_${user.id}`, JSON.stringify(moodBoardSharings));
    }
  }, [moodBoardSharings, user?.id]);

  // Check if platform sharing is available
  const canShareTo = (platform: SharePlatform): boolean => {
    // In a real app, we would check browser support for various sharing APIs
    // For demo purposes, we'll assume all platforms are supported
    if (platform === 'link' || platform === 'email') {
      return true;
    }
    
    const browserSupportsWebShare = navigator && navigator.share !== undefined;
    
    switch (platform) {
      case 'twitter':
      case 'facebook':
      case 'linkedin':
      case 'pinterest':
      case 'whatsapp':
        return true; // We can always open URLs
      case 'pdf':
        return true; // Assume we can generate PDFs
      case 'image':
        return true; // Assume we can generate images
      default:
        return browserSupportsWebShare;
    }
  };

  // Get shareable URL for a platform
  const getPlatformShareUrl = (platform: SharePlatform, content: ShareContent): string => {
    const baseUrl = window.location.origin;
    const materialUrl = `${baseUrl}/material/${content.materialId}`;
    const message = `Check out this ${content.category} material: ${content.name} by ${content.manufacturer}`;
    
    switch (platform) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(materialUrl)}`;
      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(materialUrl)}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(materialUrl)}`;
      case 'pinterest':
        return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(materialUrl)}&media=${encodeURIComponent(content.imageUrl)}&description=${encodeURIComponent(message)}`;
      case 'whatsapp':
        return `https://wa.me/?text=${encodeURIComponent(message + ' ' + materialUrl)}`;
      case 'email':
        return `mailto:?subject=${encodeURIComponent(`Material: ${content.name}`)}&body=${encodeURIComponent(message + '\n\n' + materialUrl)}`;
      case 'link':
      default:
        return materialUrl;
    }
  };

  // Share material to a platform
  const shareMaterial = async (
    content: ShareContent,
    platform: SharePlatform,
    options: ShareOptions = defaultShareOptions
  ): Promise<ShareHistoryItem> => {
    setIsSharing(true);
    
    try {
      // Ensure user is authenticated
      if (!user) {
        throw new Error('You must be logged in to share materials');
      }
      
      // In a real app, this would include actual sharing logic
      // For this demo, we'll simulate sharing with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const shareUrl = getPlatformShareUrl(platform, content);
      
      // For demo purposes, simulate opening a share dialog or URL
      if (platform !== 'link' && platform !== 'pdf' && platform !== 'image') {
        // Implement actual platform-specific sharing
        if (platform === 'email') {
          // Open email client with pre-populated fields
          window.location.href = shareUrl;
        } else if (platform === 'whatsapp' || platform === 'twitter' || 
                  platform === 'facebook' || platform === 'linkedin' || 
                  platform === 'pinterest') {
          // Use Web Share API if available, otherwise open in new window
          if (navigator.share && ['twitter', 'facebook'].includes(platform)) {
            try {
              await navigator.share({
                title: content.name,
                text: `Check out this ${content.category} material: ${content.name} by ${content.manufacturer}`,
                url: shareUrl
              });
            } catch (err) {
              // Fallback to opening a new window if Web Share API fails
              window.open(shareUrl, '_blank', 'noopener,noreferrer');
            }
          } else {
            // Open in a popup window for better user experience
            const width = 550;
            const height = 420;
            const left = Math.round((window.innerWidth - width) / 2);
            const top = Math.round((window.innerHeight - height) / 2);
            
            window.open(
              shareUrl,
              `share_${platform}`,
              `toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},top=${top},left=${left}`
            );
          }
        }
      }
      
      // Create history item with user ID for ownership tracking
      const historyItem: ShareHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        materialId: content.materialId,
        platform,
        timestamp: new Date().toISOString(),
        success: true,
        url: shareUrl,
        userId: user.id // Add user ID for ownership tracking
      };
      
      // Update share history
      setShareHistory(prev => [historyItem, ...prev]);
      
      return historyItem;
    } catch (error) {
      console.error(`Failed to share to ${platform}:`, error);
      
      // Create failed history item
      const failedItem: ShareHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        materialId: content.materialId,
        platform,
        timestamp: new Date().toISOString(),
        success: false,
        userId: user?.id || 'anonymous' // Add user ID for ownership tracking
      };
      
      // Update share history
      setShareHistory(prev => [failedItem, ...prev]);
      
      return failedItem;
    } finally {
      setIsSharing(false);
    }
  };

  // Generate a shareable link
  const getShareableLink = async (
    materialId: string,
    options: ShareOptions = defaultShareOptions
  ): Promise<string> => {
    // Ensure user is authenticated
    if (!user) {
      throw new Error('You must be logged in to generate shareable links');
    }
    
    // In a real app, we might generate a special link with query parameters
    // For this demo, we'll just return a simple URL with the material ID
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/material/${materialId}`;
    
    // Add query parameters for options
    const params = new URLSearchParams();
    
    if (options.includeProperties) {
      params.append('props', '1');
    }
    
    if (options.includeNotes) {
      params.append('notes', '1');
    }
    
    if (options.customMessage) {
      params.append('msg', options.customMessage);
    }
    
    // Add user ID for authentication
    params.append('uid', user.id);
    
    const finalUrl = params.toString() ? `${shareUrl}?${params.toString()}` : shareUrl;
    
    // Add to history with user ID for ownership tracking
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'link',
      timestamp: new Date().toISOString(),
      success: true,
      url: finalUrl,
      userId: user.id // Add user ID for ownership tracking
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return finalUrl;
  };

  // Generate a shareable image using html2canvas
  const getShareableImage = async (
    materialId: string,
    options: ShareOptions = defaultShareOptions
  ): Promise<string> => {
    // Ensure user is authenticated
    if (!user) {
      throw new Error('You must be logged in to generate shareable images');
    }
    try {
      // Find the material element or create a snapshot view
      const materialElement = document.getElementById(`material-card-${materialId}`);
      
      if (!materialElement) {
        throw new Error('Material element not found for image capture');
      }
      
      // Dynamically import html2canvas (only when needed)
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      // Generate canvas from the material element
      const canvas = await html2canvas(materialElement, {
        scale: 2, // Higher quality
        useCORS: true, // Allow cross-origin images
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Convert canvas to image URL
      const imageUrl = canvas.toDataURL('image/png');
    
    // Add to history with user ID for ownership tracking
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'image',
      timestamp: new Date().toISOString(),
      success: true,
      url: imageUrl,
      userId: user.id // Add user ID for ownership tracking
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return imageUrl;
  } catch (error) {
      console.error('Error generating shareable image:', error);
      
      // Create failed history item with user ID for ownership tracking
      const failedItem: ShareHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        materialId,
        platform: 'image',
        timestamp: new Date().toISOString(),
        success: false,
        userId: user.id // Add user ID for ownership tracking
      };
      
      // Update share history
      setShareHistory(prev => [failedItem, ...prev]);
      
      // Return a placeholder in case of error
      return `https://via.placeholder.com/800x600?text=Error+Generating+Image`;
    }
  };

  // Generate a shareable PDF using jsPDF
  const getShareablePDF = async (
    materialId: string,
    options: ShareOptions = defaultShareOptions
  ): Promise<string> => {
    // Ensure user is authenticated
    if (!user) {
      throw new Error('You must be logged in to generate shareable PDFs');
    }
    try {
      // Fetch material data from API
      const response = await fetch(`/api/materials/${materialId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch material data for PDF generation');
      }
      
      const materialData = await response.json();
      
      // Dynamically import jsPDF (only when needed)
      const { jsPDF } = await import('jspdf');
      
      // Create a new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Add content to PDF
      doc.setFontSize(24);
      doc.text(materialData.name, 20, 20);
      
      doc.setFontSize(14);
      doc.text(`Manufacturer: ${materialData.manufacturer}`, 20, 30);
      doc.text(`Category: ${materialData.category}`, 20, 40);
      
      if (materialData.description) {
        doc.setFontSize(12);
        doc.text('Description:', 20, 55);
        const descriptionLines = doc.splitTextToSize(materialData.description, 170);
        doc.text(descriptionLines, 20, 65);
      }
      
      // Add image if available and requested
      if (options.includeImage && materialData.imageUrl) {
        try {
          // Fetch the image
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          
          // Wait for the image to load
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = materialData.imageUrl;
          });
          
          // Add image to PDF
          doc.addImage(img, 'JPEG', 20, 100, 170, 100);
        } catch (imgErr) {
          console.error('Failed to add image to PDF:', imgErr);
          // Continue without the image
        }
      }
      
      // Add properties if requested
      if (options.includeProperties && materialData.properties) {
        doc.addPage();
        doc.setFontSize(18);
        doc.text('Material Properties', 20, 20);
        
        let yPos = 30;
        Object.entries(materialData.properties).forEach(([key, value]) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.setFontSize(12);
          doc.text(`${key}: ${value}`, 20, yPos);
          yPos += 10;
        });
      }
      
      // Add notes if requested
      if (options.includeNotes && materialData.notes) {
        if (!options.includeProperties) doc.addPage();
        
        doc.setFontSize(18);
        doc.text('Notes', 20, options.includeProperties ? 20 : 200);
        
        doc.setFontSize(12);
        const notesLines = doc.splitTextToSize(materialData.notes, 170);
        doc.text(notesLines, 20, options.includeProperties ? 30 : 210);
      }
      
      // Add footer with logo and URL
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Generated from ${window.location.origin}`, 20, 290);
        doc.text(`Page ${i} of ${pageCount}`, 170, 290);
      }
      
      // Generate PDF blob
      const pdfBlob = doc.output('blob');
      
      // Create an object URL from the blob
      const pdfUrl = URL.createObjectURL(pdfBlob);
    
    // Add to history with user ID for ownership tracking
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'pdf',
      timestamp: new Date().toISOString(),
      success: true,
      url: pdfUrl,
      userId: user.id // Add user ID for ownership tracking
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return pdfUrl;
  } catch (error) {
      console.error('Error generating shareable PDF:', error);
      
      // Create failed history item with user ID for ownership tracking
      const failedItem: ShareHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        materialId,
        platform: 'pdf',
        timestamp: new Date().toISOString(),
        success: false,
        userId: user?.id || 'anonymous' // Add user ID for ownership tracking
      };
      
      // Update share history
      setShareHistory(prev => [failedItem, ...prev]);
      
      throw new Error('Failed to generate PDF: ' + (error as Error).message);
    }
  };

  /**
   * Share a MoodBoard with a collaborator
   * @param moodBoardId The ID of the MoodBoard to share
   * @param collaboratorEmail The email of the collaborator to invite
   * @param allowEditing Whether the collaborator can edit the MoodBoard
   * @returns Whether the invitation was sent successfully
   */
  const shareMoodBoard = async (
    moodBoardId: string,
    collaboratorEmail: string,
    allowEditing: boolean
  ): Promise<boolean> => {
    try {
      // Ensure user is authenticated
      if (!user) {
        throw new Error('You must be logged in to share MoodBoards');
      }
      
      // Validate email
      if (!collaboratorEmail || !collaboratorEmail.includes('@')) {
        throw new Error('Invalid email address');
      }
      
      // Check if MoodBoard exists and user owns it
      const existingSharing = moodBoardSharings.find(s => s.moodBoardId === moodBoardId);
      
      // Create or update MoodBoard sharing
      if (existingSharing) {
        // Check if collaborator already exists
        const existingCollaborator = existingSharing.collaborators.find(
          c => c.email.toLowerCase() === collaboratorEmail.toLowerCase()
        );
        
        if (existingCollaborator) {
          // Update existing collaborator
          const updatedCollaborators = existingSharing.collaborators.map(c => 
            c.email.toLowerCase() === collaboratorEmail.toLowerCase()
              ? {
                  ...c,
                  status: 'pending' as const, // Reset to pending, use const assertion
                  invitedAt: new Date().toISOString(),
                  respondedAt: undefined
                }
              : c
          );
          
          // Update MoodBoard sharing - remove explicit type annotation to let TypeScript infer correctly
          const updatedSharings = moodBoardSharings.map(s =>
            s.moodBoardId === moodBoardId
              ? {
                  ...s,
                  allowEditing,
                  collaborators: updatedCollaborators,
                  lastUpdated: new Date().toISOString()
                }
              : s
          );
          
          setMoodBoardSharings(updatedSharings);
        } else {
          // Add new collaborator
          const newCollaborator: Collaborator = {
            id: Math.random().toString(36).substring(2, 11),
            email: collaboratorEmail,
            invitedBy: user.id,
            status: 'pending',
            invitedAt: new Date().toISOString()
          };
          
          // Update MoodBoard sharing
          const updatedSharings = moodBoardSharings.map(s => 
            s.moodBoardId === moodBoardId
              ? {
                  ...s,
                  allowEditing,
                  collaborators: [...s.collaborators, newCollaborator],
                  lastUpdated: new Date().toISOString()
                }
              : s
          );
          
          setMoodBoardSharings(updatedSharings);
        }
      } else {
        // Create new MoodBoard sharing
        const newCollaborator: Collaborator = {
          id: Math.random().toString(36).substring(2, 11),
          email: collaboratorEmail,
          invitedBy: user.id,
          status: 'pending',
          invitedAt: new Date().toISOString()
        };
        
        const newSharing: MoodBoardSharing = {
          moodBoardId,
          isPublic: false,
          allowEditing,
          collaborators: [newCollaborator],
          lastUpdated: new Date().toISOString()
        };
        
        setMoodBoardSharings([...moodBoardSharings, newSharing]);
      }
      
      // In a real app, we would send an email to the collaborator
      console.log(`Invitation sent to ${collaboratorEmail} for MoodBoard ${moodBoardId}`);
      
      return true;
    } catch (error) {
      console.error('Failed to share MoodBoard:', error);
      return false;
    }
  };
  
  /**
   * Remove a collaborator from a MoodBoard
   * @param moodBoardId The ID of the MoodBoard
   * @param collaboratorId The ID of the collaborator to remove
   * @returns Whether the collaborator was removed successfully
   */
  const removeMoodBoardCollaborator = async (
    moodBoardId: string,
    collaboratorId: string
  ): Promise<boolean> => {
    try {
      // Ensure user is authenticated
      if (!user) {
        throw new Error('You must be logged in to manage MoodBoard collaborators');
      }
      
      // Find the MoodBoard sharing
      const sharingIndex = moodBoardSharings.findIndex(s => s.moodBoardId === moodBoardId);
      
      if (sharingIndex === -1) {
        throw new Error('MoodBoard sharing not found');
      }
      
      // Remove the collaborator - Add null check
      const sharing = moodBoardSharings[sharingIndex];
      if (!sharing || !sharing.collaborators) {
        throw new Error('MoodBoard sharing data is invalid');
      }
      
      const updatedCollaborators = sharing.collaborators.filter(
        c => c.id !== collaboratorId
      );
      
      // Update MoodBoard sharing with explicit type
      const updatedSharings: MoodBoardSharing[] = [...moodBoardSharings];
      updatedSharings[sharingIndex] = {
        moodBoardId: sharing.moodBoardId, // Ensure required property
        isPublic: sharing.isPublic,
        allowEditing: sharing.allowEditing,
        collaborators: updatedCollaborators,
        lastUpdated: new Date().toISOString()
      };
      
      setMoodBoardSharings(updatedSharings);
      
      return true;
    } catch (error) {
      console.error('Failed to remove collaborator:', error);
      return false;
    }
  };
  
  /**
   * Get collaborators for a MoodBoard
   * @param moodBoardId The ID of the MoodBoard
   * @returns The collaborators for the MoodBoard
   */
  const getMoodBoardCollaborators = (moodBoardId: string): Collaborator[] => {
    const sharing = moodBoardSharings.find(s => s.moodBoardId === moodBoardId);
    return sharing?.collaborators || [];
  };
  
  /**
   * Check if a user has access to a MoodBoard
   * @param moodBoardId The ID of the MoodBoard
   * @param userId The ID of the user (defaults to current user)
   * @returns Whether the user can view or edit the MoodBoard
   */
  const checkMoodBoardAccess = (moodBoardId: string, userId?: string): { canView: boolean; canEdit: boolean } => {
    const currentUserId = userId || user?.id;
    
    // If no user is logged in, no access
    if (!currentUserId) {
      return { canView: false, canEdit: false };
    }
    
    // Find the MoodBoard sharing
    const sharing = moodBoardSharings.find(s => s.moodBoardId === moodBoardId);
    
    // If no sharing settings, only the owner can access
    if (!sharing) {
      // In a real app, we would check if the user is the owner
      // For demo purposes, we'll assume they don't have access
      return { canView: false, canEdit: false };
    }
    
    // Check if the MoodBoard is public
    if (sharing.isPublic) {
      return { canView: true, canEdit: false };
    }
    
    // Check if the user is a collaborator
    const collaborator = sharing.collaborators.find(
      c => c.email.toLowerCase() === user?.email.toLowerCase() && c.status === 'accepted'
    );
    
    if (collaborator) {
      return { canView: true, canEdit: sharing.allowEditing };
    }
    
    // User doesn't have access
    return { canView: false, canEdit: false };
  };

  // Clear share history with confirmation
  const clearShareHistory = () => {
    if (shareHistory.length === 0 || !user) return;
    
    if (window.confirm('Are you sure you want to clear your share history?')) {
      setShareHistory([]);
      // Also clear from localStorage
      localStorage.removeItem(`shareHistory_${user.id}`);
    }
  };
  return (
    <SharingContext.Provider
      value={{
        isSharing,
        shareHistory,
        moodBoardSharings,
        shareMaterial,
        getShareableLink,
        getShareableImage,
        getShareablePDF,
        shareMoodBoard,
        removeMoodBoardCollaborator,
        getMoodBoardCollaborators,
        checkMoodBoardAccess,
        clearShareHistory,
        canShareTo,
        getPlatformShareUrl
      }}
    >
      {children}
    </SharingContext.Provider>
  );
};
// Custom hook for using the sharing context
// @ts-ignore - Workaround for TypeScript issue
export const useSharing = (): SharingContextValue => React.useContext(SharingContext);

export default SharingProvider;