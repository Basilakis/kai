import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from './mui';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Visibility as VisibilityIcon,
  PhotoCamera as PhotoCameraIcon,
  Close as CloseIcon
} from './mui-icons';

import { PropertyReferenceImage } from '@kai/shared/src/types/property-reference';
import { propertyReferenceService } from '@kai/shared/src/services/property-reference/propertyReferenceService';
import { tileFieldDescriptions } from '@kai/shared/src/docs/tile-field-descriptions';

interface PropertyReferenceGalleryProps {
  propertyName: string;
  propertyValue: string;
  materialType: string;
  onClose?: () => void;
  readOnly?: boolean;
}

/**
 * Component for displaying and managing property reference images
 */
const PropertyReferenceGallery: React.FC<PropertyReferenceGalleryProps> = ({
  propertyName,
  propertyValue,
  materialType,
  onClose,
  readOnly = false
}) => {
  const theme = useTheme();
  const [images, setImages] = useState<PropertyReferenceImage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<PropertyReferenceImage | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState<boolean>(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState<boolean>(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Get the field description from the tile field descriptions
  const fieldDescription = propertyName in tileFieldDescriptions 
    ? tileFieldDescriptions[propertyName as keyof typeof tileFieldDescriptions] 
    : `${propertyName} property for ${materialType}`;

  // Load images on component mount
  useEffect(() => {
    loadImages();
  }, [propertyName, propertyValue, materialType]);

  // Load images from the service
  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);
      const images = await propertyReferenceService.getPropertyReferenceImages({
        propertyName,
        propertyValue,
        materialType
      });
      setImages(images);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setUploadFile(event.target.files[0]);
    }
  };

  // Handle image upload
  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      setUploadProgress(10);
      await propertyReferenceService.createPropertyReferenceImage({
        propertyName,
        propertyValue,
        materialType,
        file: uploadFile,
        description,
        isPrimary
      });
      setUploadProgress(100);
      setIsUploadDialogOpen(false);
      setUploadFile(null);
      setDescription('');
      setIsPrimary(false);
      loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadProgress(0);
    }
  };

  // Handle image update
  const handleUpdate = async () => {
    if (!selectedImage) return;

    try {
      await propertyReferenceService.updatePropertyReferenceImage({
        id: selectedImage.id,
        description,
        isPrimary
      });
      setIsEditDialogOpen(false);
      loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update image');
    }
  };

  // Handle image delete
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    try {
      await propertyReferenceService.deletePropertyReferenceImage(id);
      loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete image');
    }
  };

  // Open edit dialog
  const handleOpenEditDialog = (image: PropertyReferenceImage) => {
    setSelectedImage(image);
    setDescription(image.description || '');
    setIsPrimary(image.isPrimary);
    setIsEditDialogOpen(true);
  };

  // Open view dialog
  const handleOpenViewDialog = (image: PropertyReferenceImage) => {
    setSelectedImage(image);
    setIsViewDialogOpen(true);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" component="h2">
            {propertyValue} ({propertyName})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {fieldDescription}
          </Typography>
        </Box>
        <Box>
          {!readOnly && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsUploadDialogOpen(true)}
            >
              Add Reference Image
            </Button>
          )}
          {onClose && (
            <IconButton onClick={onClose} sx={{ ml: 1 }}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : images.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: '1px dashed',
            borderColor: 'divider'
          }}
        >
          <PhotoCameraIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            No reference images available for this property value.
          </Typography>
          {!readOnly && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setIsUploadDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Add Reference Image
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {images.map((image) => (
            <Grid item key={image.id} xs={12} sm={6} md={4} lg={3}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: image.isPrimary ? `2px solid ${theme.palette.primary.main}` : undefined
                }}
              >
                <CardMedia
                  component="img"
                  height="140"
                  image={image.url}
                  alt={`${propertyValue} (${propertyName})`}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleOpenViewDialog(image)}
                />
                {image.isPrimary && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: '50%',
                      p: 0.5
                    }}
                  >
                    <StarIcon color="primary" fontSize="small" />
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {image.description || 'No description'}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Tooltip title="View full size">
                      <IconButton size="small" onClick={() => handleOpenViewDialog(image)}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!readOnly && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenEditDialog(image)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => handleDelete(image.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onClose={() => setIsUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Reference Image</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">
              {propertyValue} ({propertyName})
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {fieldDescription}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: 2,
              backgroundColor: 'background.paper',
              borderRadius: 1,
              border: '1px dashed',
              borderColor: 'divider',
              mb: 2
            }}
          >
            {uploadFile ? (
              <Box sx={{ width: '100%', textAlign: 'center' }}>
                <img
                  src={URL.createObjectURL(uploadFile)}
                  alt="Preview"
                  style={{ maxWidth: '100%', maxHeight: 200, marginBottom: 8 }}
                />
                <Typography variant="body2">{uploadFile.name}</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setUploadFile(null)}
                  sx={{ mt: 1 }}
                >
                  Remove
                </Button>
              </Box>
            ) : (
              <>
                <PhotoCameraIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  Click to select an image
                </Typography>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  sx={{ mt: 2 }}
                >
                  Select Image
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleFileSelect}
                  />
                </Button>
              </>
            )}
          </Box>
          <TextField
            label="Description"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            margin="normal"
          />
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <IconButton
              color={isPrimary ? 'primary' : 'default'}
              onClick={() => setIsPrimary(!isPrimary)}
            >
              {isPrimary ? <StarIcon /> : <StarBorderIcon />}
            </IconButton>
            <Typography variant="body2">
              {isPrimary ? 'Primary reference image' : 'Set as primary reference image'}
            </Typography>
          </Box>
          {uploadProgress > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <CircularProgress variant="determinate" value={uploadProgress} size={24} sx={{ mr: 1 }} />
              <Typography variant="body2">Uploading... {uploadProgress}%</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsUploadDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!uploadFile || uploadProgress > 0}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Reference Image</DialogTitle>
        <DialogContent>
          {selectedImage && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1">
                  {propertyValue} ({propertyName})
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fieldDescription}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <img
                  src={selectedImage.url}
                  alt={`${propertyValue} (${propertyName})`}
                  style={{ maxWidth: '100%', maxHeight: 200 }}
                />
              </Box>
              <TextField
                label="Description"
                multiline
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                margin="normal"
              />
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <IconButton
                  color={isPrimary ? 'primary' : 'default'}
                  onClick={() => setIsPrimary(!isPrimary)}
                >
                  {isPrimary ? <StarIcon /> : <StarBorderIcon />}
                </IconButton>
                <Typography variant="body2">
                  {isPrimary ? 'Primary reference image' : 'Set as primary reference image'}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdate} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onClose={() => setIsViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {propertyValue} ({propertyName})
            </Typography>
            <IconButton onClick={() => setIsViewDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedImage && (
            <>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <img
                  src={selectedImage.url}
                  alt={`${propertyValue} (${propertyName})`}
                  style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)' }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedImage.description || 'No description'}
              </Typography>
              {selectedImage.isPrimary && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <StarIcon color="primary" fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">Primary reference image</Typography>
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PropertyReferenceGallery;
