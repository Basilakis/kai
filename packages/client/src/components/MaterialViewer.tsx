import React, { useState, useEffect, useRef, useCallback } from 'react';
import { materialRecognitionProvider } from '@kai/shared/services/recognition/materialProvider';
import type { ExtractedColor, MaterialRecognitionOptions, MaterialRecognitionMatch, RecognitionResult } from '@kai/shared/services/recognition/types';

interface MaterialViewerProps {
  // Material information
  materialId?: string;
  name: string;
  manufacturer: string;
  category: string;
  description?: string;
  properties?: Record<string, string>;
  
  // Image sources - can be URL or data URL
  imageUrl: string;
  additionalImages?: string[];
  
  // Recognition results
  confidenceScore?: number;
  detectedAreas?: DetectedArea[];
  
  // Display options
  showControls?: boolean;
  showColorPalette?: boolean;
  enableZoom?: boolean;
  enableRotation?: boolean;
  show3DPreview?: boolean;
  showAnnotations?: boolean;
  showMagnifier?: boolean;
  
  // Optional callbacks
  onAddToComparison?: (materialId: string) => void;
  onViewDetails?: (materialId: string) => void;
  onShare?: (materialId: string) => void;
  className?: string;
}

interface DetectedArea {
  id: string;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage of total width
  height: number; // percentage of total height
  confidence: number; // 0-1
  label?: string;
  color?: string;
}


// Material color interface
interface MaterialColor {
  h: number;
  s: number;
  l: number;
  name: string;
}

// Sample detected areas (for demo when none provided)
const sampleDetectedAreas: DetectedArea[] = [
  { 
    id: '1', 
    x: 10, 
    y: 15, 
    width: 35, 
    height: 40, 
    confidence: 0.92,
    label: 'Primary material',
    color: 'rgba(0, 128, 255, 0.5)'
  },
  { 
    id: '2', 
    x: 55, 
    y: 30, 
    width: 25, 
    height: 25, 
    confidence: 0.78,
    label: 'Secondary material',
    color: 'rgba(255, 128, 0, 0.5)'
  }
];

interface MagnifierPosition {
  x: number;
  y: number;
  visible: boolean;
}

const defaultColors: ExtractedColor[] = [
  { color: '#F9F9F9', percentage: 60, name: 'White' },
  { color: '#D9D9D9', percentage: 20, name: 'Light Gray' },
  { color: '#A9A9A9', percentage: 15, name: 'Gray' },
  { color: '#696969', percentage: 5, name: 'Dark Gray' },
];

/**
 * MaterialViewer Component
 * 
 * Advanced material visualization component with:
 * - High-quality image display with zoom and pan
 * - Multiple view angles
 * - Color palette extraction
 * - 3D preview mode
 * - Comparison tools
 * - Detailed information display
 */
const MaterialViewer: React.FC<MaterialViewerProps> = ({
  materialId = '0',
  name,
  manufacturer,
  category,
  description,
  properties = {},
  imageUrl,
  additionalImages = [],
  confidenceScore,
  detectedAreas = [],
  showControls = true,
  showColorPalette = true,
  enableZoom = true,
  enableRotation = true,
  show3DPreview = false,
  showAnnotations = true,
  showMagnifier = true,
  onAddToComparison,
  onViewDetails,
  onShare,
  className = '',
}) => {
  // State
  const [mainImage, setMainImage] = useState<string>(imageUrl);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [extractedColors, setExtractedColors] = useState<ExtractedColor[]>(defaultColors);
  const [showingAnnotations, setShowingAnnotations] = useState<boolean>(showAnnotations);
  const [magnifierPosition, setMagnifierPosition] = useState<MagnifierPosition>({ x: 0, y: 0, visible: false });
  const [activeDetectedAreas, setActiveDetectedAreas] = useState<DetectedArea[]>(
    detectedAreas.length > 0 ? detectedAreas : sampleDetectedAreas
  );
  const [magnifierZoom, setMagnifierZoom] = useState<number>(2.5);
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [comparisonSlider, setComparisonSlider] = useState<number>(50);
  const [compareWithImage, setCompareWithImage] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const magnifierRef = useRef<HTMLDivElement>(null);

  // Initialize the component
  useEffect(() => {
    // Reset the main image when the imageUrl prop changes
    setMainImage(imageUrl);
    
    // Simulate extracting colors from the image
    // In a real app, this would use a color extraction library or API
    extractColorsFromImage(imageUrl);
    
    // Reset zoom and position when the image changes
    resetView();
  }, [imageUrl]);
  
  useEffect(() => {
    // Update active detected areas when prop changes
    if (detectedAreas.length > 0) {
      setActiveDetectedAreas(detectedAreas);
    }
  }, [detectedAreas]);

  // Extract colors from image
  const extractColorsFromImage = async (url: string): Promise<void> => {
    try {
      // Fetch the image as a blob
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }
      
      const imageBlob = await response.blob();
      
      // Use the recognition provider to extract colors
      const options: MaterialRecognitionOptions = {
        confidenceThreshold: 0.6,
        maxResults: 1, // We only need one result for colors
        includeMetadata: true,
        modelType: 'hybrid'
      };
      const recognitionResult = await materialRecognitionProvider.recognize(imageBlob, options);

      // Get colors from the first match
      const match = recognitionResult.matches[0] as MaterialRecognitionMatch;
      if (recognitionResult.matches.length > 0 && match?.extractedColors) {
        setExtractedColors(match.extractedColors);
      } else {
        // Fallback to default colors if no colors were extracted
        setExtractedColors(defaultColors);
      }
    } catch (error) {
      console.error('Failed to extract colors:', error);
      // Fallback to default colors on error
      setExtractedColors(defaultColors);
    }
  };

  // Reset view to default
  const resetView = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setMagnifierPosition({ x: 0, y: 0, visible: false });
  };

  // Handle zoom in
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  // Handle rotation
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!enableZoom || zoom <= 1) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Update magnifier position if enabled
    if (showMagnifier && containerRef.current && viewMode === '2d') {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      setMagnifierPosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        visible: true
      });
    }
    
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setPosition({
      x: position.x + dx,
      y: position.y + dy
    });
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, position, showMagnifier, viewMode]);

  // Handle mouse up to end dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle mouse leave to end dragging
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setMagnifierPosition(prev => ({ ...prev, visible: false }));
  }, []);

  // Handle wheel for zooming
  const handleWheel = (e: WheelEvent) => {
    if (!enableZoom) return;
    
    e.preventDefault();
    
    // Delta for zooming in and out
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newZoom = Math.max(0.5, Math.min(3, zoom + delta));
    
    setZoom(newZoom);
  };

  // Switch to 3D mode
  const toggle3DMode = () => {
    setViewMode(prev => prev === '2d' ? '3d' : '2d');
  };

  // Handle thumbnail click
  const handleThumbnailClick = (url: string) => {
    setMainImage(url);
    resetView();
  };

  // Toggle annotations visibility
  const toggleAnnotations = () => {
    setShowingAnnotations(prev => !prev);
  };
  
  // Toggle comparison mode
  const toggleComparisonMode = () => {
    if (comparisonMode) {
      setComparisonMode(false);
      setCompareWithImage(null);
    } else if (additionalImages && additionalImages.length > 0) {
      setComparisonMode(true);
      // Check if additionalImages[0] is defined before setting
      if (additionalImages[0]) {
        setCompareWithImage(additionalImages[0]);
      }
      setComparisonSlider(50);
    }
  };
  
  // Handle comparison slider change
  const handleComparisonSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setComparisonSlider(Number(e.target.value));
  };
  
  // Share material
  const handleShare = () => {
    if (onShare) {
      onShare(materialId);
    }
  };
  
  // Increase magnifier zoom
  const increaseMagnifierZoom = () => {
    setMagnifierZoom(prev => Math.min(prev + 0.5, 5));
  };
  
  // Decrease magnifier zoom
  const decreaseMagnifierZoom = () => {
    setMagnifierZoom(prev => Math.max(prev - 0.5, 1.5));
  };

  // Calculate the image transform style
  const imageTransform = `scale(${zoom}) rotate(${rotation}deg) translate(${position.x / zoom}px, ${position.y / zoom}px)`;

  return (
    <div className={`material-viewer bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Header with material name and controls */}
      <div className="p-4 border-b flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">{name}</h3>
          <div className="flex items-center">
            <p className="text-sm text-gray-600">{manufacturer} • {category}</p>
            {confidenceScore !== undefined && (
              <div className="ml-2 flex items-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  {Math.round(confidenceScore * 100)}% match
                </span>
              </div>
            )}
          </div>
        </div>
        
        {showControls && (
          <div className="flex space-x-2">
            {onAddToComparison && (
              <button 
                onClick={() => onAddToComparison(materialId)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700"
              >
                Compare
              </button>
            )}
            
            {onShare && (
              <button 
                onClick={handleShare}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700"
              >
                Share
              </button>
            )}
            
            {onViewDetails && (
              <button 
                onClick={() => onViewDetails(materialId)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium text-white"
              >
                Details
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Main content */}
      <div className="flex flex-col md:flex-row">
        {/* Main image container */}
        <div 
          ref={containerRef}
          className="image-container relative flex-grow p-4 flex items-center justify-center bg-gray-100 overflow-hidden"
          style={{ minHeight: '300px', height: '300px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        >
          {comparisonMode && compareWithImage && viewMode === '2d' ? (
            /* Comparison slider mode */
            <div className="relative w-full h-full">
              {/* Base image (right side) */}
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${comparisonSlider}%)` }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <img 
                    src={compareWithImage} 
                    alt={`Compare with ${name}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
              
              {/* Main image (left side) */}
              <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - comparisonSlider}% 0 0)` }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <img 
                    src={mainImage} 
                    alt={name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
              
              {/* Slider control */}
              <div className="absolute inset-y-0 left-0 w-full flex items-center justify-center pointer-events-none">
                <div 
                  className="h-full w-0.5 bg-white shadow-md pointer-events-auto cursor-ew-resize"
                  style={{ left: `${comparisonSlider}%` }}
                  onMouseDown={(e: React.MouseEvent<HTMLDivElement> & { preventDefault: () => void; stopPropagation: () => void }) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const handleMove = (moveEvent: globalThis.MouseEvent) => {
                      const rect = containerRef.current?.getBoundingClientRect();
                      if (rect) {
                        const x = ((moveEvent.clientX - rect.left) / rect.width) * 100;
                        setComparisonSlider(Math.max(0, Math.min(100, x)));
                      }
                    };
                    
                    const handleUp = () => {
                      document.removeEventListener('mousemove', handleMove);
                      document.removeEventListener('mouseup', handleUp);
                    };
                    
                    document.addEventListener('mousemove', handleMove);
                    document.addEventListener('mouseup', handleUp);
                  }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={comparisonSlider}
                  onChange={handleComparisonSliderChange}
                  className="absolute bottom-4 w-2/3 pointer-events-auto z-10"
                />
              </div>
            </div>
          ) : viewMode === '2d' ? (
            <div 
              className="image-wrapper transition-transform duration-100 ease-out"
              style={{ transform: imageTransform }}
            >
              <img
                ref={imageRef}
                src={mainImage}
                alt={name}
                className="max-h-full max-w-full object-contain select-none"
                draggable={false}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="rotate-3d w-48 h-48 relative perspective">
                {/* Simple 3D cube visualization of material */}
                <div className="cube w-full h-full relative transform-style-3d animate-rotate">
                  <div className="cube-face front absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                  <div className="cube-face back absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                  <div className="cube-face right absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                  <div className="cube-face left absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                  <div className="cube-face top absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                  <div className="cube-face bottom absolute inset-0" style={{ backgroundImage: `url(${mainImage})`, backgroundSize: 'cover' }}></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Annotation overlay */}
          {showingAnnotations && viewMode === '2d' && !comparisonMode && activeDetectedAreas.length > 0 && (
            <div className="absolute inset-0 pointer-events-none">
              {activeDetectedAreas.map((area) => (
                <div
                  key={area.id}
                  className="absolute border-2 shadow-sm flex items-center justify-center"
                  style={{
                    left: `${area.x}%`,
                    top: `${area.y}%`,
                    width: `${area.width}%`,
                    height: `${area.height}%`,
                    backgroundColor: area.color || 'rgba(0, 128, 255, 0.2)',
                    borderColor: area.color ? area.color.replace('0.2', '0.8') : 'rgba(0, 128, 255, 0.8)',
                  }}
                >
                  {area.label && (
                    <div className="bg-white bg-opacity-80 text-xs px-1 py-0.5 rounded shadow">
                      {area.label} ({Math.round(area.confidence * 100)}%)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          {/* Magnifier */}
          {magnifierPosition.visible && viewMode === '2d' && showMagnifier && !comparisonMode && (
            <div 
              ref={magnifierRef}
              className="absolute w-32 h-32 border-2 border-white rounded-full overflow-hidden shadow-lg pointer-events-none z-20"
              style={{
                left: `calc(${magnifierPosition.x}% - 64px)`,
                top: `calc(${magnifierPosition.y}% - 64px)`,
                backgroundImage: `url(${mainImage})`,
                backgroundPosition: `calc((${magnifierPosition.x}% - 50%) * -${magnifierZoom} + 50%) calc((${magnifierPosition.y}% - 50%) * -${magnifierZoom} + 50%)`,
                backgroundSize: `${magnifierZoom * 100}%`,
                backgroundRepeat: 'no-repeat',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-px h-full bg-white bg-opacity-40"></div>
                <div className="h-px w-full bg-white bg-opacity-40"></div>
              </div>
            </div>
          )}
          
          {/* Image controls overlay */}
          {showControls && (
            <div className="absolute bottom-4 right-4 flex space-x-2">
              {enableZoom && (
                <>
                  <button 
                    onClick={handleZoomOut}
                    className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                    </svg>
                  </button>
                  <button 
                    onClick={handleZoomIn}
                    className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </>
              )}
              
              {enableRotation && (
                <button 
                  onClick={handleRotate}
                  className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              )}
              
              {show3DPreview && (
                <button 
                  onClick={toggle3DMode}
                  className={`p-2 rounded-full shadow-md hover:bg-gray-100 ${viewMode === '3d' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                  </svg>
                </button>
              )}
              
              {activeDetectedAreas.length > 0 && viewMode === '2d' && (
                <button 
                  onClick={toggleAnnotations}
                  className={`p-2 rounded-full shadow-md hover:bg-gray-100 ${showingAnnotations ? 'bg-green-100 text-green-700' : 'bg-white text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </button>
              )}
              
              {showMagnifier && viewMode === '2d' && (
                <button 
                  onClick={() => setMagnifierPosition(prev => ({ ...prev, visible: !prev.visible }))}
                  className={`p-2 rounded-full shadow-md hover:bg-gray-100 ${magnifierPosition.visible ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              )}
              
              {additionalImages?.length > 0 && viewMode === '2d' && (
                <button 
                  onClick={toggleComparisonMode}
                  className={`p-2 rounded-full shadow-md hover:bg-gray-100 ${comparisonMode ? 'bg-purple-100 text-purple-700' : 'bg-white text-gray-700'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
              )}
              
              <button 
                onClick={resetView}
                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Magnifier zoom controls */}
          {magnifierPosition.visible && showMagnifier && !comparisonMode && (
            <div className="absolute bottom-4 left-4 flex space-x-2">
              <button 
                onClick={decreaseMagnifierZoom}
                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                </svg>
              </button>
              <button 
                onClick={increaseMagnifierZoom}
                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:bg-gray-100"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        {/* Right sidebar with thumbnails and info */}
        <div className="w-full md:w-64 flex-shrink-0 border-t md:border-t-0 md:border-l">
          {/* Thumbnails */}
          {additionalImages?.length > 0 && (
            <div className="p-3 border-b">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">View Angles</p>
              <div className="grid grid-cols-4 gap-2">
                <div 
                  className={`cursor-pointer rounded overflow-hidden border-2 ${mainImage === imageUrl ? 'border-blue-500' : 'border-gray-200'}`}
                  onClick={() => handleThumbnailClick(imageUrl)}
                >
                  <img src={imageUrl} alt={`${name} main`} className="w-full h-12 object-cover" />
                </div>
                {additionalImages.map((url, index) => (
                  <div 
                    key={index}
                    className={`cursor-pointer rounded overflow-hidden border-2 ${mainImage === url ? 'border-blue-500' : 'border-gray-200'}`}
                    onClick={() => handleThumbnailClick(url)}
                  >
                    <img src={url} alt={`${name} view ${index + 1}`} className="w-full h-12 object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Color palette */}
          {showColorPalette && (
            <div className="p-3 border-b">
              <div className="flex justify-between mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Color Palette</p>
                <p className="text-xs text-gray-400">AI extracted</p>
              </div>
              <div className="flex space-x-1 mb-2">
                {extractedColors.map((color, index) => (
                  <div 
                    key={index} 
                    className="w-full h-6 rounded"
                    style={{ 
                      backgroundColor: color.color,
                      flexGrow: color.percentage 
                    }}
                    title={`${color.name || color.color} (${color.percentage}%)`}
                  ></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {extractedColors.map((color, index) => (
                  <div key={index} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-1"
                      style={{ backgroundColor: color.color }}
                    ></div>
                    <span className="text-gray-600 truncate">{color.name || color.color}</span>
                    <span className="ml-1 text-gray-400">{color.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Material properties */}
          {Object.keys(properties).length > 0 && (
            <div className="p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Properties</p>
              <div className="space-y-1">
                {Object.entries(properties).map(([key, value]) => (
                  <div key={key} className="grid grid-cols-2 text-xs">
                    <span className="text-gray-500">{key}:</span>
                    <span className="text-gray-900 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Description */}
          {description && (
            <div className="p-3 border-t">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-xs text-gray-700">{description}</p>
            </div>
          )}
          
          {/* Confidence score */}
          {confidenceScore !== undefined && (
            <div className="p-3 border-t">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Recognition Confidence</p>
              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${confidenceScore * 100}%` }}
                  ></div>
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">
                  {Math.round(confidenceScore * 100)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {confidenceScore > 0.9 ? 'Very high confidence match' :
                 confidenceScore > 0.8 ? 'High confidence match' :
                 confidenceScore > 0.6 ? 'Medium confidence match' :
                 'Low confidence match'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* CSS for 3D cube animation */}
      <style jsx>{`
        .perspective { perspective: 800px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .animate-rotate { animation: rotate 20s infinite linear; }
        
        .cube-face {
          backface-visibility: hidden;
          transform: translateZ(100px);
        }
        
        .cube-face.back { transform: rotateY(180deg) translateZ(100px); }
        .cube-face.right { transform: rotateY(90deg) translateZ(100px); }
        .cube-face.left { transform: rotateY(-90deg) translateZ(100px); }
        .cube-face.top { transform: rotateX(90deg) translateZ(100px); }
        .cube-face.bottom { transform: rotateX(-90deg) translateZ(100px); }
        
        @keyframes rotate {
          from { transform: rotateX(0) rotateY(0); }
          to { transform: rotateX(360deg) rotateY(360deg); }
        }
      `}</style>
    </div>
  );
};

export default MaterialViewer;