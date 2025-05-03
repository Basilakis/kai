import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { useAuth } from '../../../client/src/hooks/useAuth';

interface VisualReferenceAnnotatorProps {
  referenceId: string;
  images: any[];
  initialImageIndex?: number;
}

/**
 * Visual Reference Annotator Component
 * 
 * Component for annotating visual reference images.
 */
const VisualReferenceAnnotator: React.FC<VisualReferenceAnnotatorProps> = ({
  referenceId,
  images,
  initialImageIndex = 0
}) => {
  const { token } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(initialImageIndex);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<any | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [annotationType, setAnnotationType] = useState<'rectangle' | 'circle' | 'arrow' | 'text'>('rectangle');
  const [annotationText, setAnnotationText] = useState<string>('');
  const [annotationColor, setAnnotationColor] = useState<string>('#FF0000');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [annotationToDelete, setAnnotationToDelete] = useState<any | null>(null);

  // Get current image
  const currentImage = images[currentImageIndex];

  // Fetch annotations for the current image
  useEffect(() => {
    if (!currentImage) return;
    
    const fetchAnnotations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/visual-references/images/${currentImage.id}/annotations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch annotations');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setAnnotations(data.annotations);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnnotations();
  }, [currentImage, token]);

  // Draw annotations on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !currentImage) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    if (imageRef.current.complete) {
      drawImage();
    } else {
      imageRef.current.onload = drawImage;
    }
    
    function drawImage() {
      if (!canvasRef.current || !imageRef.current || !ctx) return;
      
      // Set canvas dimensions to match image
      canvas.width = imageRef.current.width * scale;
      canvas.height = imageRef.current.height * scale;
      
      // Draw image
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
      
      // Draw annotations
      drawAnnotations();
    }
    
    function drawAnnotations() {
      if (!ctx) return;
      
      annotations.forEach(annotation => {
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 2;
        ctx.fillStyle = annotation.color + '33'; // Add transparency
        
        const x = annotation.x * scale;
        const y = annotation.y * scale;
        const width = annotation.width * scale;
        const height = annotation.height * scale;
        
        // Draw based on annotation type
        switch (annotation.type) {
          case 'rectangle':
            ctx.strokeRect(x, y, width, height);
            ctx.fillRect(x, y, width, height);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.ellipse(
              x + width / 2,
              y + height / 2,
              width / 2,
              height / 2,
              0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            ctx.fill();
            break;
          case 'arrow':
            drawArrow(ctx, x, y, x + width, y + height, annotation.color);
            break;
          case 'text':
            // Just draw a rectangle for now
            ctx.strokeRect(x, y, width, height);
            ctx.fillRect(x, y, width, height);
            break;
        }
        
        // Draw text
        if (annotation.text) {
          ctx.font = '14px Arial';
          ctx.fillStyle = 'white';
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 3;
          
          // Draw text background
          const textWidth = ctx.measureText(annotation.text).width + 10;
          const textHeight = 20;
          const textX = x;
          const textY = y - textHeight;
          
          ctx.fillStyle = annotation.color;
          ctx.fillRect(textX, textY, textWidth, textHeight);
          
          // Draw text
          ctx.fillStyle = 'white';
          ctx.fillText(annotation.text, textX + 5, textY + 15);
        }
        
        // Highlight selected annotation
        if (selectedAnnotation && selectedAnnotation.id === annotation.id) {
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x - 5, y - 5, width + 10, height + 10);
          ctx.setLineDash([]);
        }
      });
      
      // Draw current annotation if drawing
      if (isDrawing && startPoint && currentPoint) {
        ctx.strokeStyle = annotationColor;
        ctx.lineWidth = 2;
        ctx.fillStyle = annotationColor + '33'; // Add transparency
        
        const x = Math.min(startPoint.x, currentPoint.x);
        const y = Math.min(startPoint.y, currentPoint.y);
        const width = Math.abs(currentPoint.x - startPoint.x);
        const height = Math.abs(currentPoint.y - startPoint.y);
        
        switch (annotationType) {
          case 'rectangle':
            ctx.strokeRect(x, y, width, height);
            ctx.fillRect(x, y, width, height);
            break;
          case 'circle':
            ctx.beginPath();
            ctx.ellipse(
              x + width / 2,
              y + height / 2,
              width / 2,
              height / 2,
              0,
              0,
              2 * Math.PI
            );
            ctx.stroke();
            ctx.fill();
            break;
          case 'arrow':
            drawArrow(ctx, startPoint.x, startPoint.y, currentPoint.x, currentPoint.y, annotationColor);
            break;
          case 'text':
            ctx.strokeRect(x, y, width, height);
            ctx.fillRect(x, y, width, height);
            break;
        }
      }
    }
  }, [annotations, currentImage, isDrawing, startPoint, currentPoint, selectedAnnotation, scale, annotationColor, annotationType]);

  // Helper function to draw an arrow
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
  ) => {
    const headLength = 15; // Length of arrow head in pixels
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Draw arrow head
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    // Check if clicked on an existing annotation
    const clickedAnnotation = annotations.find(annotation => {
      const annotX = annotation.x * scale;
      const annotY = annotation.y * scale;
      const annotWidth = annotation.width * scale;
      const annotHeight = annotation.height * scale;
      
      return (
        x >= annotX &&
        x <= annotX + annotWidth &&
        y >= annotY &&
        y <= annotY + annotHeight
      );
    });
    
    if (clickedAnnotation) {
      setSelectedAnnotation(clickedAnnotation);
      return;
    }
    
    // Start drawing new annotation
    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
    setSelectedAnnotation(null);
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    setCurrentPoint({ x, y });
  };

  // Handle mouse up
  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false);
      return;
    }
    
    // Calculate annotation coordinates
    const x = Math.min(startPoint.x, currentPoint.x) / scale;
    const y = Math.min(startPoint.y, currentPoint.y) / scale;
    const width = Math.abs(currentPoint.x - startPoint.x) / scale;
    const height = Math.abs(currentPoint.y - startPoint.y) / scale;
    
    // Minimum size check
    if (width < 10 / scale || height < 10 / scale) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }
    
    // Open form to add text
    setFormOpen(true);
    setIsEditing(false);
    
    // Reset drawing state
    setIsDrawing(false);
  };

  // Handle mouse leave
  const handleMouseLeave = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  // Handle form submission
  const handleFormSubmit = async () => {
    if (!currentImage) return;
    
    try {
      setLoading(true);
      setError(null);
      
      if (isEditing && selectedAnnotation) {
        // Update existing annotation
        const response = await fetch(`/api/visual-references/annotations/${selectedAnnotation.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            text: annotationText,
            type: annotationType,
            color: annotationColor
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update annotation');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setSuccess('Annotation updated successfully');
          
          // Update annotations list
          setAnnotations(prev => prev.map(a => 
            a.id === selectedAnnotation.id ? data.annotation : a
          ));
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } else {
        // Create new annotation
        if (!startPoint || !currentPoint) return;
        
        const x = Math.min(startPoint.x, currentPoint.x) / scale;
        const y = Math.min(startPoint.y, currentPoint.y) / scale;
        const width = Math.abs(currentPoint.x - startPoint.x) / scale;
        const height = Math.abs(currentPoint.y - startPoint.y) / scale;
        
        const response = await fetch(`/api/visual-references/images/${currentImage.id}/annotations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            x,
            y,
            width,
            height,
            text: annotationText,
            type: annotationType,
            color: annotationColor
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to create annotation');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setSuccess('Annotation created successfully');
          
          // Add new annotation to list
          setAnnotations(prev => [...prev, data.annotation]);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      }
      
      // Reset form
      setFormOpen(false);
      setAnnotationText('');
      setStartPoint(null);
      setCurrentPoint(null);
      setSelectedAnnotation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle annotation edit
  const handleEditAnnotation = (annotation: any) => {
    setSelectedAnnotation(annotation);
    setAnnotationText(annotation.text);
    setAnnotationType(annotation.type);
    setAnnotationColor(annotation.color);
    setIsEditing(true);
    setFormOpen(true);
  };

  // Handle annotation delete dialog open
  const handleOpenDeleteDialog = (annotation: any) => {
    setAnnotationToDelete(annotation);
    setDeleteDialogOpen(true);
  };

  // Handle annotation delete
  const handleDeleteAnnotation = async () => {
    if (!annotationToDelete) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/visual-references/annotations/${annotationToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete annotation');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Annotation deleted successfully');
        
        // Remove annotation from list
        setAnnotations(prev => prev.filter(a => a.id !== annotationToDelete.id));
        
        if (selectedAnnotation?.id === annotationToDelete.id) {
          setSelectedAnnotation(null);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setAnnotationToDelete(null);
    }
  };

  // Handle navigation to previous image
  const handlePreviousImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
      setSelectedAnnotation(null);
    }
  };

  // Handle navigation to next image
  const handleNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
      setSelectedAnnotation(null);
    }
  };

  // Handle zoom in
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };

  // Handle zoom out
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };

  // Handle zoom reset
  const handleZoomReset = () => {
    setScale(1);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Image Annotator
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={8}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Button
                  variant="outlined"
                  startIcon={<ArrowBackIcon />}
                  onClick={handlePreviousImage}
                  disabled={currentImageIndex === 0}
                  sx={{ mr: 1 }}
                >
                  Previous
                </Button>
                
                <Button
                  variant="outlined"
                  endIcon={<ArrowForwardIcon />}
                  onClick={handleNextImage}
                  disabled={currentImageIndex === images.length - 1}
                >
                  Next
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Image {currentImageIndex + 1} of {images.length}
              </Typography>
              
              <Box>
                <Button onClick={handleZoomOut} disabled={scale <= 0.5}>-</Button>
                <Button onClick={handleZoomReset}>{Math.round(scale * 100)}%</Button>
                <Button onClick={handleZoomIn} disabled={scale >= 3}>+</Button>
              </Box>
            </Box>
            
            <Box
              sx={{
                position: 'relative',
                border: '1px solid #ccc',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 600
              }}
            >
              {currentImage ? (
                <>
                  <img
                    ref={imageRef}
                    src={currentImage.url}
                    alt={currentImage.caption}
                    style={{ display: 'none' }}
                    onLoad={() => {
                      // Force redraw when image loads
                      if (canvasRef.current) {
                        const canvas = canvasRef.current;
                        const ctx = canvas.getContext('2d');
                        if (ctx && imageRef.current) {
                          canvas.width = imageRef.current.width * scale;
                          canvas.height = imageRef.current.height * scale;
                          ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
                        }
                      }
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseLeave}
                    style={{ cursor: 'crosshair' }}
                  />
                </>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">No image selected</Typography>
                </Box>
              )}
              
              {loading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)'
                  }}
                >
                  <CircularProgress />
                </Box>
              )}
            </Box>
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Drawing Tools
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={annotationType}
                    onChange={(e) => setAnnotationType(e.target.value as any)}
                    label="Type"
                  >
                    <MenuItem value="rectangle">Rectangle</MenuItem>
                    <MenuItem value="circle">Circle</MenuItem>
                    <MenuItem value="arrow">Arrow</MenuItem>
                    <MenuItem value="text">Text Box</MenuItem>
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Color</InputLabel>
                  <Select
                    value={annotationColor}
                    onChange={(e) => setAnnotationColor(e.target.value)}
                    label="Color"
                    renderValue={(value) => (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: value,
                            mr: 1
                          }}
                        />
                        {value}
                      </Box>
                    )}
                  >
                    <MenuItem value="#FF0000">Red</MenuItem>
                    <MenuItem value="#00FF00">Green</MenuItem>
                    <MenuItem value="#0000FF">Blue</MenuItem>
                    <MenuItem value="#FFFF00">Yellow</MenuItem>
                    <MenuItem value="#FF00FF">Magenta</MenuItem>
                    <MenuItem value="#00FFFF">Cyan</MenuItem>
                    <MenuItem value="#000000">Black</MenuItem>
                    <MenuItem value="#FFFFFF">White</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Click and drag on the image to create an annotation.
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle1" gutterBottom>
              Annotations
            </Typography>
            
            {annotations.length > 0 ? (
              <List>
                {annotations.map(annotation => (
                  <ListItem
                    key={annotation.id}
                    selected={selectedAnnotation?.id === annotation.id}
                    sx={{
                      borderLeft: `4px solid ${annotation.color}`,
                      mb: 1,
                      bgcolor: 'background.paper'
                    }}
                  >
                    <ListItemText
                      primary={annotation.text || 'No text'}
                      secondary={`Type: ${annotation.type}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleEditAnnotation(annotation)}
                        title="Edit annotation"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => handleOpenDeleteDialog(annotation)}
                        title="Delete annotation"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info">
                No annotations for this image. Draw on the image to create annotations.
              </Alert>
            )}
          </Grid>
        </Grid>
      </Paper>
      
      {/* Annotation Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {isEditing ? 'Edit Annotation' : 'Add Annotation'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Annotation Text"
            fullWidth
            multiline
            rows={3}
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            sx={{ mt: 2 }}
          />
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={annotationType}
                  onChange={(e) => setAnnotationType(e.target.value as any)}
                  label="Type"
                  disabled={isEditing} // Can't change type when editing
                >
                  <MenuItem value="rectangle">Rectangle</MenuItem>
                  <MenuItem value="circle">Circle</MenuItem>
                  <MenuItem value="arrow">Arrow</MenuItem>
                  <MenuItem value="text">Text Box</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Color</InputLabel>
                <Select
                  value={annotationColor}
                  onChange={(e) => setAnnotationColor(e.target.value)}
                  label="Color"
                  renderValue={(value) => (
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: value,
                          mr: 1
                        }}
                      />
                      {value}
                    </Box>
                  )}
                >
                  <MenuItem value="#FF0000">Red</MenuItem>
                  <MenuItem value="#00FF00">Green</MenuItem>
                  <MenuItem value="#0000FF">Blue</MenuItem>
                  <MenuItem value="#FFFF00">Yellow</MenuItem>
                  <MenuItem value="#FF00FF">Magenta</MenuItem>
                  <MenuItem value="#00FFFF">Cyan</MenuItem>
                  <MenuItem value="#000000">Black</MenuItem>
                  <MenuItem value="#FFFFFF">White</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setFormOpen(false);
              setStartPoint(null);
              setCurrentPoint(null);
            }}
            startIcon={<CancelIcon />}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFormSubmit}
            variant="contained"
            startIcon={loading ? <CircularProgress size={24} /> : <SaveIcon />}
            disabled={loading}
          >
            {isEditing ? 'Update' : 'Save'} Annotation
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Annotation</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete this annotation? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteAnnotation} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualReferenceAnnotator;
