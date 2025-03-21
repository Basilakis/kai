import React from 'react';
import { useState, useEffect } from 'react';
// Access useCallback and useRef directly from React namespace
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageUploaderProps {
  onImageSelect: (files: File[], croppedImageUrls?: string[]) => void;
  aspectRatio?: number;
  maxFileSizeMb?: number;
  showProcessingIndicator?: boolean;
  showConfidenceScores?: boolean; 
  showMaterialTags?: boolean;
  acceptedFileTypes?: string[];
  initialImages?: string[];
  previewClassName?: string;
  className?: string;
  showZoomControls?: boolean;
  showCropControls?: boolean;
  cropShape?: 'rect' | 'round';
  uploadButtonLabel?: string;
  placeholderText?: string;
  multiple?: boolean;
  showAIDetection?: boolean;
  mobileBreakpoint?: number;
  maxFiles?: number;
}

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  croppedUrl?: string;
  crop?: Crop;
  aiSuggestions?: DetectedMaterial[];
  uploadProgress: number;
}

interface DetectedMaterial {
  id: string;
  label: string;
  confidence: number;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage of width
  height: number; // percentage of height
  color: string; // highlight color
  tags?: string[]; // material tags like "durable", "natural", "synthetic"
  similarMaterials?: Array<{name: string, confidenceScore: number}>;
}

const defaultAcceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Advanced Image Uploader Component
 * 
 * Features:
 * - Multi-file upload support
 * - Enhanced drag and drop functionality
 * - AI-powered material detection and crop suggestions
 * - Image preview with gallery view
 * - Zoom and pan controls
 * - Optional cropping with different aspect ratios
 * - File type validation
 * - Size validation
 * - Upload progress visualization
 * - Responsive design for mobile and desktop
 */
const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageSelect,
  aspectRatio,
  maxFileSizeMb = 10,
  acceptedFileTypes = defaultAcceptedTypes,
  initialImages = [],
  previewClassName = "max-h-64 max-w-full",
  className = "",
  showZoomControls = true,
  showCropControls = true,
  cropShape = 'rect',
  uploadButtonLabel = "Upload Image",
  placeholderText = "Drag and drop images, or click to select",
  multiple = false,
  showAIDetection = true,
  mobileBreakpoint = 768,
  maxFiles = 5
}) => {
  // State
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [isCropping, setIsCropping] = useState<boolean>(false);
  const [tempCrop, setTempCrop] = useState<Crop>({
    unit: '%',
    width: 50,
    height: aspectRatio ? 50 / aspectRatio : 50,
    x: 25,
    y: 25
  });
  const [zoom, setZoom] = useState<number>(1);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showAIDetectionOverlay, setShowAIDetectionOverlay] = useState<boolean>(showAIDetection);
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);
  const [processingStage, setProcessingStage] = useState<string>('Analyzing image');
  const [showConfidenceScores] = useState<boolean>(true);
  const [showMaterialTags] = useState<boolean>(true);
  const [materialDetailsVisible, setMaterialDetailsVisible] = useState<string | null>(null);
  
  // Refs
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  // Initialize with any initial images
  useEffect(() => {
    if (initialImages.length > 0) {
      const initialImageObjects = initialImages.map((url, index) => ({
        id: `initial-${index}`,
        file: new File([], `initial-image-${index}.jpg`, { type: 'image/jpeg' }),
        url,
        uploadProgress: 100
      }));
      setImages(initialImageObjects);
    }
  }, [initialImages]);

  // Check for mobile viewport
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, [mobileBreakpoint]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url);
        }
        if (image.croppedUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(image.croppedUrl);
        }
      });
    };
  }, [images]);

  // Generate a random ID
  const generateId = () => `id-${Math.random().toString(36).substr(2, 9)}`;

  // Mock AI material detection
  const detectMaterials = async (imageId: string): Promise<DetectedMaterial[]> => {
    setAiProcessing(true);
    
    // Enhanced visual feedback during processing
    if (showProcessingIndicator) {
      // Simulate stages of analysis
      const stages = ['Analyzing image', 'Identifying material patterns', 'Calculating confidence scores', 'Matching with database'];
      stages.forEach((stage, index) => {
        setTimeout(() => setProcessingStage(stage), index * 500);
      });
    }
    
    // Simulate API call delay with varying time to seem more realistic
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
    
    // Generate more realistic detection results
    const detectionsCount = 1 + Math.floor(Math.random() * 3); // 1-4 detections
    const detections: DetectedMaterial[] = [];
    
    const colors = [
      'rgba(0, 128, 255, 0.3)', // blue
      'rgba(255, 128, 0, 0.3)',  // orange
      'rgba(0, 192, 64, 0.3)',   // green
      'rgba(128, 0, 255, 0.3)',  // purple
      'rgba(255, 0, 128, 0.3)'   // pink
    ];
    
    const materials = [
      'Marble', 'Oak Wood', 'Granite', 
      'Quartz', 'Ceramic Tile', 'Brushed Steel',
      'Tempered Glass', 'Cotton Fabric', 'Polished Concrete',
      'Leather', 'Laminate', 'Porcelain',
      'Bamboo', 'Vinyl', 'Terrazzo'
    ];
    
    const materialTags = {
      'Marble': ['natural', 'stone', 'luxury', 'heavy'],
      'Oak Wood': ['natural', 'wood', 'durable', 'traditional'],
      'Granite': ['natural', 'stone', 'durable', 'heavy'],
      'Quartz': ['engineered', 'stone', 'durable', 'modern'],
      'Ceramic Tile': ['manufactured', 'durable', 'water-resistant'],
      'Brushed Steel': ['metal', 'modern', 'durable'],
      'Tempered Glass': ['manufactured', 'fragile', 'modern'],
      'Cotton Fabric': ['natural', 'soft', 'breathable'],
      'Polished Concrete': ['engineered', 'durable', 'modern'],
      'Leather': ['natural', 'durable', 'premium'],
      'Laminate': ['manufactured', 'affordable', 'versatile'],
      'Porcelain': ['manufactured', 'durable', 'water-resistant'],
      'Bamboo': ['natural', 'sustainable', 'renewable'],
      'Vinyl': ['synthetic', 'affordable', 'water-resistant'],
      'Terrazzo': ['composite', 'durable', 'decorative']
    };
    
    // Generate relations between materials
    const materialRelations = {
      'Marble': ['Granite', 'Quartz', 'Terrazzo'],
      'Oak Wood': ['Bamboo', 'Laminate'],
      'Granite': ['Marble', 'Quartz'],
      'Quartz': ['Marble', 'Granite'],
      'Ceramic Tile': ['Porcelain', 'Terrazzo'],
      'Brushed Steel': ['Metal'],
      'Tempered Glass': ['Glass'],
      'Cotton Fabric': ['Fabric'],
      'Polished Concrete': ['Concrete'],
      'Leather': ['Fabric'],
      'Laminate': ['Vinyl', 'Wood'],
      'Porcelain': ['Ceramic Tile'],
      'Bamboo': ['Oak Wood'],
      'Vinyl': ['Laminate'],
      'Terrazzo': ['Marble', 'Ceramic Tile']
    };
    
    for (let i = 0; i < detectionsCount; i++) {
      // Generate more realistic looking position and size
      // Create more variance in detection sizes to simulate different materials
      let x: number, y: number, width: number, height: number;
      
      if (i === 0) {
        // Make first detection more prominent and centered
        x = 20 + Math.floor(Math.random() * 20);
        y = 20 + Math.floor(Math.random() * 20);
        width = 30 + Math.floor(Math.random() * 25);
        height = 30 + Math.floor(Math.random() * 25);
      } else {
        // Secondary detections are smaller and more scattered
        x = 10 + Math.floor(Math.random() * 60);
        y = 10 + Math.floor(Math.random() * 60);
        width = 15 + Math.floor(Math.random() * 20);
        height = 15 + Math.floor(Math.random() * 20);
      }
      
      // Ensure we don't exceed the image bounds
      const constrainedWidth = Math.min(width, 90 - x);
      const constrainedHeight = Math.min(height, 90 - y);
      
      // Select a material
      const materialIndex = Math.floor(Math.random() * materials.length);
      const material = materials[materialIndex];
      
      // Generate more realistic confidence score
      // Primary detections have higher confidence
      const baseConfidence = i === 0 ? 0.85 : 0.65;
      const confidenceVariance = i === 0 ? 0.15 : 0.25;
      const confidence = baseConfidence + (Math.random() * confidenceVariance);
      
      // Generate similar materials with confidence scores
      const similarMaterialsArray = [];
      if (material && materialRelations[material]) {
        for (const relatedMaterial of materialRelations[material]) {
          similarMaterialsArray.push({
            name: relatedMaterial,
            confidenceScore: confidence - (0.1 + Math.random() * 0.2) // Slightly lower confidence
          });
        }
      }
      
      detections.push({
        id: `detection-${imageId}-${i}`,
        label: material || "Unknown Material",
        confidence: confidence,
        x,
        y,
        width: constrainedWidth,
        height: constrainedHeight,
        color: colors[i % colors.length],
        tags: material && materialTags[material] ? materialTags[material] : [],
        similarMaterials: similarMaterialsArray
      });
    }
    
    setAiProcessing(false);
    return detections;
  };

  // Process file upload
  const processFile = async (file: File): Promise<UploadedImage | null> => {
    // Validate file type
    if (!acceptedFileTypes.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        [file.name]: `Invalid file type. Accepted types: ${acceptedFileTypes.map(t => t.replace('image/', '')).join(', ')}`
      }));
      return null;
    }
    
    // Validate file size
    if (file.size > maxFileSizeMb * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        [file.name]: `File too large. Maximum size: ${maxFileSizeMb}MB`
      }));
      return null;
    }
    
    // Create a unique ID for the image
    const id = generateId();
    
    // Generate the preview URL
    const url = URL.createObjectURL(file);
    
    // Create image object
    const imageObject: UploadedImage = {
      id,
      file,
      url,
      uploadProgress: 0
    };
    
    // Simulate upload progress
    const simulateUpload = () => {
      setImages(prevImages => {
        const index = prevImages.findIndex(img => img.id === id);
        if (index === -1) return prevImages;
        
        const newImages = [...prevImages];
        newImages[index] = {
          ...newImages[index],
          uploadProgress: Math.min(100, newImages[index].uploadProgress + 10)
        };
        
        return newImages;
      });
      
      if (imageObject.uploadProgress < 100) {
        setTimeout(simulateUpload, 100 + Math.random() * 200);
      } else if (showAIDetection) {
        // When upload is complete, run AI detection
        detectMaterials(id).then(detections => {
          setImages(prevImages => {
            const index = prevImages.findIndex(img => img.id === id);
            if (index === -1) return prevImages;
            
            const newImages = [...prevImages];
            newImages[index] = {
              ...newImages[index],
              aiSuggestions: detections
            };
            
            return newImages;
          });
        });
      }
    };
    
    // Start the upload simulation
    setTimeout(simulateUpload, 100);
    
    return imageObject;
  };

  // Handle file selection
  const handleFileSelect = React.useCallback(async (selectedFiles: FileList) => {
    if (!selectedFiles.length) return;
    
    setErrors({});
    setIsProcessing(true);
    
    // Convert FileList to array
    const filesArray = Array.from(selectedFiles);
    
    // Check if we're exceeding the maximum number of files
    const totalFiles = images.length + filesArray.length;
    if (totalFiles > maxFiles) {
      setErrors(prev => ({
        ...prev,
        general: `You can upload a maximum of ${maxFiles} files.`
      }));
      setIsProcessing(false);
      return;
    }
    
    // Process each file
    const processedImages: UploadedImage[] = [];
    
    for (const file of filesArray) {
      const processedImage = await processFile(file);
      if (processedImage) {
        processedImages.push(processedImage);
      }
    }
    
    // Update state
    setImages(prev => [...prev, ...processedImages]);
    setCurrentImageIndex(images.length);
    setIsProcessing(false);
    
    // Notify parent component
    const files = processedImages.map(img => img.file);
    onImageSelect(files);
  }, [images, maxFiles, acceptedFileTypes, maxFileSizeMb, onImageSelect, showAIDetection]);
  
  // Handle drag and drop
  const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if the drag has left the drop zone (not just its children)
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        setIsDragging(false);
      }
    }
  };
  
  // Handle browse button click
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  };
  
  // Handle zoom change
  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(parseFloat(e.target.value));
  };
  
  // Handle image load
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
  };
  
  // Apply crop to the current image
  const applyCrop = () => {
    if (!imgRef.current || !tempCrop.width || !tempCrop.height) {
      return;
    }
    
    const currentImage = images[currentImageIndex];
    if (!currentImage) return;
    
    const canvas = document.createElement('canvas');
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = tempCrop.width * scaleX;
    canvas.height = tempCrop.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    ctx.drawImage(
      image,
      tempCrop.x * scaleX,
      tempCrop.y * scaleY,
      tempCrop.width * scaleX,
      tempCrop.height * scaleY,
      0,
      0,
      tempCrop.width * scaleX,
      tempCrop.height * scaleY
    );
    
    // Get the data URL and update state
    const croppedImageUrl = canvas.toDataURL('image/jpeg');
    
    setImages(prev => {
      const newImages = [...prev];
      newImages[currentImageIndex] = {
        ...newImages[currentImageIndex],
        croppedUrl: croppedImageUrl,
        crop: tempCrop
      };
      return newImages;
    });
    
    // Notify parent component
    const files = images.map(img => img.file);
    const croppedUrls = images.map((img, idx) => 
      idx === currentImageIndex ? croppedImageUrl : img.croppedUrl
    );
    
    onImageSelect(files, croppedUrls.filter(Boolean) as string[]);
    
    setIsCropping(false);
  };
  
  // Start cropping the current image
  const startCropping = () => {
    setIsCropping(true);
    
    // If we have AI suggestions, use the first one as the initial crop
    const currentImage = images[currentImageIndex];
    if (currentImage?.aiSuggestions && currentImage.aiSuggestions.length > 0) {
      const suggestion = currentImage.aiSuggestions[0];
      setTempCrop({
        unit: '%',
        x: suggestion.x,
        y: suggestion.y,
        width: suggestion.width,
        height: suggestion.height
      });
    } else {
      // Default crop
      setTempCrop({
        unit: '%',
        width: 50,
        height: aspectRatio ? 50 / aspectRatio : 50,
        x: 25,
        y: 25
      });
    }
  };
  
  // Apply AI suggested crop
  const applySuggestedCrop = (suggestion: DetectedMaterial) => {
    setTempCrop({
      unit: '%',
      x: suggestion.x,
      y: suggestion.y,
      width: suggestion.width,
      height: suggestion.height
    });
    
    setIsCropping(true);
  };
  
  // Cancel cropping
  const cancelCropping = () => {
    setIsCropping(false);
  };
  
  // Remove the current image
  const removeCurrentImage = () => {
    // Revoke the object URL to avoid memory leaks
    const image = images[currentImageIndex];
    if (image) {
      if (image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
      if (image.croppedUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(image.croppedUrl);
      }
    }
    
    // Remove the image from state
    setImages(prev => {
      const newImages = [...prev];
      newImages.splice(currentImageIndex, 1);
      return newImages;
    });
    
    // Update current image index
    if (currentImageIndex >= images.length - 1) {
      setCurrentImageIndex(Math.max(0, images.length - 2));
    }
    
    // Notify parent component
    setTimeout(() => {
      const files = images
        .filter((_, idx) => idx !== currentImageIndex)
        .map(img => img.file);
      
      const croppedUrls = images
        .filter((_, idx) => idx !== currentImageIndex)
        .map(img => img.croppedUrl)
        .filter(Boolean) as string[];
      
      onImageSelect(files, croppedUrls);
    }, 0);
  };
  
  // Remove all images
  const removeAllImages = () => {
    // Revoke all object URLs
    images.forEach(image => {
      if (image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
      if (image.croppedUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(image.croppedUrl);
      }
    });
    
    // Clear state
    setImages([]);
    setCurrentImageIndex(0);
    
    // Notify parent component
    onImageSelect([], []);
  };
  
  // Navigate to the previous image
  const previousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };
  
  // Navigate to the next image
  const nextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  // Toggle AI detection overlay
  const toggleAIDetection = () => {
    setShowAIDetectionOverlay(prev => !prev);
  };
  
  // Render the upload area
  const renderUploadArea = () => (
    <div
      ref={dropZoneRef}
      className={`border-2 border-dashed ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'} rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors`}
      onClick={handleBrowseClick}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
      </svg>
      <p className="text-sm text-gray-600 mb-2">{isDragging ? 'Drop files here' : placeholderText}</p>
      <p className="text-xs text-gray-500">
        Supported formats: {acceptedFileTypes.map(t => t.replace('image/', '').toUpperCase()).join(', ')} 
        (max {maxFileSizeMb}MB{multiple ? `, ${maxFiles} files` : ''})
      </p>
      <button className="mt-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
        {uploadButtonLabel}
      </button>
    </div>
  );
  
  // Render errors
  const renderErrors = () => {
    const errorMessages = Object.values(errors);
    if (errorMessages.length === 0) return null;
    
    return (
      <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">There were errors with your submission:</h3>
            <div className="mt-2 text-sm text-red-700">
              <ul className="list-disc pl-5 space-y-1">
                {errorMessages.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render image preview
  const renderImagePreview = () => {
    if (images.length === 0) return null;
    
    const currentImage = images[currentImageIndex];
    if (!currentImage) return null;
    
    return (
      <div className="image-preview-container border rounded-lg overflow-hidden">
        {/* Header with filename, controls and navigation */}
        <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
          <div className="text-sm font-medium text-gray-700 flex-1 mr-2 truncate">
            {currentImage.file.name || `Image ${currentImageIndex + 1}`}
            <span className="ml-2 text-xs text-gray-500">
              ({(currentImage.file.size / (1024 * 1024)).toFixed(2)} MB)
            </span>
            {currentImage.uploadProgress < 100 && (
              <span className="ml-2 text-xs text-blue-500">
                Uploading... {currentImage.uploadProgress}%
              </span>
            )}
            {currentImage.aiSuggestions && currentImage.aiSuggestions.length > 0 && (
              <span className="ml-2 text-xs text-green-500">
                AI detections: {currentImage.aiSuggestions.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Navigation controls for multiple images */}
            {images.length > 1 && (
              <div className="flex space-x-1 mr-2">
                <button 
                  onClick={previousImage}
                  disabled={currentImageIndex === 0}
                  className={`p-1 rounded-full ${currentImageIndex === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-xs text-gray-500 self-center">
                  {currentImageIndex + 1} / {images.length}
                </span>
                <button 
                  onClick={nextImage}
                  disabled={currentImageIndex === images.length - 1}
                  className={`p-1 rounded-full ${currentImageIndex === images.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* AI detection toggle */}
            {showAIDetection && currentImage.aiSuggestions && currentImage.aiSuggestions.length > 0 && (
              <button 
                onClick={toggleAIDetection}
                className={`p-1.5 rounded-full ${showAIDetectionOverlay ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'} hover:bg-opacity-80`}
                title="Toggle AI detection overlay"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
            )}
            
            {/* Crop button */}
            {showCropControls && !isCropping && currentImage.uploadProgress === 100 && (
              <button 
                onClick={startCropping}
                className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium bg-white text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Crop
              </button>
            )}
            
            {/* Remove button */}
            <button 
              onClick={removeCurrentImage}
              className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium bg-white text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Remove
            </button>
            
            {/* Clear all button (only show for multiple images) */}
            {images.length > 1 && (
              <button 
                onClick={removeAllImages}
                className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs font-medium bg-white text-gray-700 hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Image display area */}
        <div className="relative overflow-hidden p-2 flex justify-center bg-gray-100" style={{ minHeight: '300px' }}>
          {/* Show upload progress overlay if still uploading */}
          {currentImage.uploadProgress < 100 && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="bg-white rounded-lg p-4 w-64 shadow-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Uploading image...</div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${currentImage.uploadProgress}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">{currentImage.uploadProgress}%</div>
              </div>
            </div>
          )}
          
          {/* Show AI processing overlay */}
          {aiProcessing && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
              <div className="bg-white rounded-lg p-4 w-64 shadow-lg">
                <div className="text-sm font-medium text-gray-700 mb-2">Analyzing image with AI...</div>
                <div className="flex justify-center">
                  <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
            </div>
          )}
          
          {/* Render cropping UI if in cropping mode */}
          {isCropping ? (
            <ReactCrop
              src={currentImage.url}
              crop={tempCrop}
              onChange={(c) => setTempCrop(c)}
              onImageLoaded={onImageLoad}
              className="max-w-full h-auto"
              circularCrop={cropShape === 'round'}
              style={{ maxHeight: '400px' }}
            />
          ) : (
            /* Otherwise render normal image preview */
            <div className="relative" style={{ maxHeight: '400px' }}>
              <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }} className="transition-transform">
                <img 
                  src={currentImage.croppedUrl || currentImage.url} 
                  alt="Preview" 
                  className={previewClassName}
                  style={{ maxHeight: '400px' }}
                  onLoad={onImageLoad}
                />
              </div>
              
              {/* Enhanced AI detection overlays */}
              {showAIDetectionOverlay && currentImage.aiSuggestions && (
                <div className="absolute inset-0 pointer-events-none">
                  {currentImage.aiSuggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className="absolute border-2 shadow-sm flex items-center justify-center group"
                      style={{
                        left: `${suggestion.x}%`,
                        top: `${suggestion.y}%`,
                        width: `${suggestion.width}%`,
                        height: `${suggestion.height}%`,
                        backgroundColor: suggestion.color,
                        borderColor: suggestion.color.replace('0.3', '0.7'),
                      }}
                    >
                      {/* Enhanced material label with visual indicators */}
                      <div className="bg-white bg-opacity-90 text-xs p-1 rounded shadow max-w-full">
                        <div className="font-medium">{suggestion.label}</div>
                        
                        {/* Confidence score visualization */}
                        {showConfidenceScores && (
                          <div className="mt-1">
                            <div className="flex items-center">
                              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    suggestion.confidence > 0.9 ? 'bg-green-500' : 
                                    suggestion.confidence > 0.7 ? 'bg-blue-500' : 
                                    suggestion.confidence > 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`} 
                                  style={{ width: `${suggestion.confidence * 100}%` }}
                                ></div>
                              </div>
                              <span className="ml-1 text-xs font-medium">
                                {Math.round(suggestion.confidence * 100)}%
                              </span>
                            </div>
                            
                            {/* Show similar materials if available */}
                            {suggestion.similarMaterials && suggestion.similarMaterials.length > 0 && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                Also similar to: 
                                {suggestion.similarMaterials.slice(0, 2).map((sim, idx) => (
                                  <span key={idx} className="ml-1">
                                    {sim.name} ({Math.round(sim.confidenceScore * 100)}%)
                                    {idx < Math.min(suggestion.similarMaterials.length, 2) - 1 ? ',' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Material tags */}
                        {showMaterialTags && suggestion.tags && suggestion.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {suggestion.tags.map((tag, idx) => (
                              <span 
                                key={idx} 
                                className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xxs"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Enhanced actions for detected material */}
                      <div className="absolute bottom-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        <button
                          onClick={() => applySuggestedCrop(suggestion)}
                          className="bg-blue-600 text-white text-xs font-medium px-1.5 py-0.5 rounded"
                          title="Use this area as crop"
                        >
                          Crop
                        </button>
                        <button
                          onClick={() => setMaterialDetailsVisible(suggestion.id)}
                          className="bg-gray-600 text-white text-xs font-medium px-1.5 py-0.5 rounded"
                          title="View material details"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Processing indicators for AI analysis */}
              {aiProcessing && (
                <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 rounded-lg shadow-lg p-2 max-w-xs">
                  <div className="flex items-center">
                    <div className="mr-2 relative w-5 h-5">
                      <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{processingStage || "Analyzing image..."}</p>
                      <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Mini thumbnails for multiple images */}
              {images.length > 1 && (
                <div className="absolute bottom-2 left-0 right-0 flex justify-center overflow-x-auto py-1 px-2">
                  <div className="flex space-x-1 bg-black bg-opacity-50 rounded-full p-1">
                    {images.map((img, idx) => (
                      <div 
                        key={img.id}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full cursor-pointer transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-gray-400 hover:bg-gray-300'}`}
                      ></div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls area */}
        <div className="p-3 border-t bg-gray-50">
          {/* Zoom controls */}
          {showZoomControls && !isCropping && (
            <div className="flex items-center mb-3">
              <svg className="w-4 h-4 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={zoom}
                onChange={handleZoomChange}
                className="flex-grow mx-2"
              />
              <span className="text-xs font-medium text-gray-600">{Math.round(zoom * 100)}%</span>
            </div>
          )}
          
          {/* Crop controls */}
          {isCropping && (
            <div className="flex justify-end space-x-2 mt-2">
              <button
                onClick={cancelCropping}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium bg-white text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={applyCrop}
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Apply Crop
              </button>
            </div>
          )}
          
          {/* Gallery view for multiple images */}
          {images.length > 1 && !isCropping && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">All Images</p>
              <div className="flex overflow-x-auto space-x-2 pb-2">
                {images.map((img, idx) => (
                  <div 
                    key={img.id} 
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`relative flex-shrink-0 w-16 h-16 rounded overflow-hidden cursor-pointer border-2 ${idx === currentImageIndex ? 'border-blue-500' : 'border-transparent hover:border-gray-300'}`}
                  >
                    <img src={img.croppedUrl || img.url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                    {img.uploadProgress < 100 && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                      </div>
                    )}
                  </div>
                ))}
                
                {/* Add more button if not at max files */}
                {images.length < maxFiles && (
                  <div 
                    onClick={handleBrowseClick}
                    className="flex-shrink-0 w-16 h-16 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-gray-400"
                  >
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className={`image-uploader ${className}`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={acceptedFileTypes.join(',')}
        className="hidden"
        multiple={multiple}
      />
      
      {/* Show errors if any */}
      {renderErrors()}
      
      {/* Show upload area if no images or explicitly in add mode */}
      {images.length === 0 ? renderUploadArea() : renderImagePreview()}
      
      {/* Show upload button if we have images but can add more */}
      {images.length > 0 && images.length < maxFiles && multiple && !isCropping && (
        <div className="mt-4">
          <button
            onClick={handleBrowseClick}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add More Images
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;