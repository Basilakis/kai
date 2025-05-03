import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { useAuth } from '../../../client/src/hooks/useAuth';

interface VisualReferenceGalleryProps {
  images: any[];
  onSelectImage?: (image: any) => void;
  onDeleteImage?: (image: any) => void;
  onSetPrimary?: (image: any) => void;
}

/**
 * Visual Reference Gallery Component
 * 
 * Component for displaying a gallery of visual reference images.
 */
const VisualReferenceGallery: React.FC<VisualReferenceGalleryProps> = ({
  images,
  onSelectImage,
  onDeleteImage,
  onSetPrimary
}) => {
  const { token } = useAuth();
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [imageToDelete, setImageToDelete] = useState<any | null>(null);

  // Handle image selection
  const handleSelectImage = (image: any) => {
    setSelectedImage(image);
    
    if (onSelectImage) {
      onSelectImage(image);
    }
  };

  // Handle lightbox open
  const handleOpenLightbox = (image: any) => {
    setSelectedImage(image);
    setLightboxOpen(true);
  };

  // Handle lightbox close
  const handleCloseLightbox = () => {
    setLightboxOpen(false);
  };

  // Handle delete dialog open
  const handleOpenDeleteDialog = (image: any) => {
    setImageToDelete(image);
    setDeleteDialogOpen(true);
  };

  // Handle delete dialog close
  const handleCloseDeleteDialog = () => {
    setImageToDelete(null);
    setDeleteDialogOpen(false);
  };

  // Handle image deletion
  const handleDeleteImage = async () => {
    if (!imageToDelete) return;
    
    if (onDeleteImage) {
      onDeleteImage(imageToDelete);
      handleCloseDeleteDialog();
      return;
    }
    
    try {
      const response = await fetch(`/api/visual-references/images/${imageToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        // Remove the image from the list
        const updatedImages = images.filter(img => img.id !== imageToDelete.id);
        
        // Close the dialog
        handleCloseDeleteDialog();
      } else {
        console.error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  // Handle set primary image
  const handleSetPrimary = async (image: any) => {
    if (onSetPrimary) {
      onSetPrimary(image);
      return;
    }
    
    try {
      const response = await fetch(`/api/visual-references/images/${image.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isPrimary: true
        })
      });
      
      if (response.ok) {
        // Update the images list
        const updatedImages = images.map(img => ({
          ...img,
          isPrimary: img.id === image.id
        }));
      } else {
        console.error('Failed to set primary image');
      }
    } catch (error) {
      console.error('Error setting primary image:', error);
    }
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {images.map(image => (
          <Grid item xs={12} sm={6} md={4} key={image.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: selectedImage?.id === image.id ? '2px solid primary.main' : 'none'
              }}
            >
              {image.isPrimary && (
                <Chip
                  label="Primary"
                  color="primary"
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1
                  }}
                />
              )}
              
              <CardMedia
                component="img"
                height="140"
                image={image.url}
                alt={image.caption}
                sx={{ objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => handleOpenLightbox(image)}
              />
              
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {image.caption}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  {image.width} x {image.height} • {(image.fileSize / 1024).toFixed(1)} KB
                </Typography>
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'space-between' }}>
                <Box>
                  <IconButton
                    size="small"
                    onClick={() => handleOpenLightbox(image)}
                    title="View larger"
                  >
                    <ZoomInIcon />
                  </IconButton>
                  
                  <IconButton
                    size="small"
                    onClick={() => handleSelectImage(image)}
                    title="Edit annotations"
                  >
                    <EditIcon />
                  </IconButton>
                </Box>
                
                <Box>
                  {!image.isPrimary && (
                    <IconButton
                      size="small"
                      onClick={() => handleSetPrimary(image)}
                      title="Set as primary"
                    >
                      <StarBorderIcon />
                    </IconButton>
                  )}
                  
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleOpenDeleteDialog(image)}
                    title="Delete image"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Lightbox Dialog */}
      <Dialog
        open={lightboxOpen}
        onClose={handleCloseLightbox}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 0 }}>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage.url}
              alt={selectedImage.caption}
              sx={{
                width: '100%',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          {selectedImage && (
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, ml: 2 }}>
              {selectedImage.caption}
            </Typography>
          )}
          <Button onClick={handleCloseLightbox}>Close</Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Delete Image</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete this image? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteImage} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VisualReferenceGallery;
