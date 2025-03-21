import React from 'react';

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
  // Share methods
  shareMaterial: (
    content: ShareContent,
    platform: SharePlatform,
    options?: ShareOptions
  ) => Promise<ShareHistoryItem>;
  getShareableLink: (materialId: string, options?: ShareOptions) => Promise<string>;
  getShareableImage: (materialId: string, options?: ShareOptions) => Promise<string>;
  getShareablePDF: (materialId: string, options?: ShareOptions) => Promise<string>;
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
  shareMaterial: async () => ({ 
    id: '', 
    materialId: '', 
    platform: 'link', 
    timestamp: '', 
    success: false 
  }),
  getShareableLink: async () => '',
  getShareableImage: async () => '',
  getShareablePDF: async () => '',
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
 */
export const SharingProvider: React.FC<SharingProviderProps> = ({ children }) => {
  // State
  const [isSharing, setIsSharing] = React.useState<boolean>(false);
  const [shareHistory, setShareHistory] = React.useState<ShareHistoryItem[]>([]);

  // Load share history from localStorage on mount
  React.useEffect(() => {
    const loadShareHistory = () => {
      try {
        const saved = localStorage.getItem('shareHistory');
        if (saved) {
          setShareHistory(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load share history:', error);
      }
    };

    loadShareHistory();
  }, []);

  // Save share history to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem('shareHistory', JSON.stringify(shareHistory));
  }, [shareHistory]);

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
      // In a real app, this would include actual sharing logic
      // For this demo, we'll simulate sharing with a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const shareUrl = getPlatformShareUrl(platform, content);
      
      // For demo purposes, simulate opening a share dialog or URL
      if (platform !== 'link' && platform !== 'pdf' && platform !== 'image') {
        // In a real implementation, we would trigger platform-specific sharing
        console.log(`Sharing to ${platform}: ${shareUrl}`);
        
        // Simulate opening a new window for social platforms
        // window.open(shareUrl, '_blank');
      }
      
      // Create history item
      const historyItem: ShareHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        materialId: content.materialId,
        platform,
        timestamp: new Date().toISOString(),
        success: true,
        url: shareUrl,
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
    
    const finalUrl = params.toString() ? `${shareUrl}?${params.toString()}` : shareUrl;
    
    // Add to history
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'link',
      timestamp: new Date().toISOString(),
      success: true,
      url: finalUrl,
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return finalUrl;
  };

  // Generate a shareable image
  const getShareableImage = async (
    materialId: string,
    options: ShareOptions = defaultShareOptions
  ): Promise<string> => {
    // In a real app, this would generate an actual image using canvas or server-side rendering
    // For this demo, we'll just return a placeholder URL
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const imageUrl = `https://via.placeholder.com/800x600?text=Material+${materialId}`;
    
    // Add to history
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'image',
      timestamp: new Date().toISOString(),
      success: true,
      url: imageUrl,
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return imageUrl;
  };

  // Generate a shareable PDF
  const getShareablePDF = async (
    materialId: string,
    options: ShareOptions = defaultShareOptions
  ): Promise<string> => {
    // In a real app, this would generate an actual PDF using a library like jsPDF
    // For this demo, we'll just return a placeholder URL
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pdfUrl = `https://example.com/material-${materialId}.pdf`;
    
    // Add to history
    const historyItem: ShareHistoryItem = {
      id: Math.random().toString(36).substring(2, 11),
      materialId,
      platform: 'pdf',
      timestamp: new Date().toISOString(),
      success: true,
      url: pdfUrl,
    };
    
    setShareHistory(prev => [historyItem, ...prev]);
    
    return pdfUrl;
  };

  // Clear share history
  const clearShareHistory = () => {
    setShareHistory([]);
  };

  return (
    <SharingContext.Provider
      value={{
        isSharing,
        shareHistory,
        shareMaterial,
        getShareableLink,
        getShareableImage,
        getShareablePDF,
        clearShareHistory,
        canShareTo,
        getPlatformShareUrl,
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