import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Grid,
  Button,
  Tooltip
} from '@mui/material';
import {
  Image as ImageIcon,
  ZoomIn as ZoomInIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { api } from '../../utils/api';
import { MaterialType } from '../common/MaterialTypeSelector';

interface PropertyVisualReferenceProps {
  propertyName: string;
  propertyValue?: string;
  materialType: MaterialType;
  showTitle?: boolean;
  maxItems?: number;
  onPredict?: (prediction: any) => void;
}

/**
 * PropertyVisualReference Component
 * 
 * This component displays visual references for a specific property.
 * It can be used in the Material Metadata Panel to show visual examples of property values.
 */
const PropertyVisualReference: React.FC<PropertyVisualReferenceProps> = ({
  propertyName,
  propertyValue,
  materialType,
  showTitle = true,
  maxItems = 3,
  onPredict
}) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [references, setReferences] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [predicting, setPredicting] = useState<boolean>(false);
  const [prediction, setPrediction] = useState<any | null>(null);

  // Load references
  useEffect(() => {
    loadReferences();
  }, [propertyName, propertyValue, materialType]);

  // Load references from API
  const loadReferences = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/ai/visual-reference/properties/${propertyName}/references`, {
        params: {
          materialType,
          propertyValue
        }
      });
      
      setReferences(response.data.references || []);
    } catch (error) {
      console.error('Error loading references:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle image click
  const handleImageClick = (imagePath: string) => {
    setSelectedImage(imagePath);
    setDialogOpen(true);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedImage(null);
  };

  // Handle predict
  const handlePredict = async (imagePath: string) => {
    if (!onPredict) return;
    
    setPredicting(true);
    try {
      const response = await api.post('/api/ai/visual-reference/predict', {
        propertyName,
        materialType,
        imagePath
      });
      
      const predictionResult = response.data.prediction;
      setPrediction(predictionResult);
      
      if (onPredict) {
        onPredict(predictionResult);
      }
    } catch (error) {
      console.error('Error predicting property:', error);
    } finally {
      setPredicting(false);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Render empty state
  if (references.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="textSecondary">
          No visual references available for this property
        </Typography>
      </Box>
    );
  }

  // Limit the number of references to display
  const displayReferences = references.slice(0, maxItems);

  return (
    <Box>
      {showTitle && (
        <Typography variant="subtitle2" gutterBottom>
          Visual References for {propertyName}
          {propertyValue && `: ${propertyValue}`}
        </Typography>
      )}

      <Grid container spacing={1}>
        {displayReferences.map((reference) => (
          <Grid item xs={4} key={reference.id}>
            <Card 
              sx={{ 
                height: '100%', 
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 3
                }
              }}
              onClick={() => handleImageClick(reference.imagePath)}
            >
              <CardMedia
                component="img"
                height="80"
                image={reference.imagePath}
                alt={reference.propertyValue}
                sx={{ objectFit: 'cover' }}
              />
              <CardContent sx={{ p: 1 }}>
                <Typography variant="caption" noWrap>
                  {reference.propertyValue}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {references.length > maxItems && (
          <Grid item xs={4}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                '&:hover': {
                  boxShadow: 3
                }
              }}
              onClick={() => setDialogOpen(true)}
            >
              <Box sx={{ textAlign: 'center', p: 1 }}>
                <Typography variant="caption">
                  +{references.length - maxItems} more
                </Typography>
              </Box>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Image Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Visual References for {propertyName}
          {propertyValue && `: ${propertyValue}`}
          <IconButton
            aria-label="close"
            onClick={handleDialogClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {references.map((reference) => (
              <Grid item xs={12} sm={6} md={4} key={reference.id}>
                <Card>
                  <CardMedia
                    component="img"
                    height="200"
                    image={reference.imagePath}
                    alt={reference.propertyValue}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Chip 
                        label={reference.propertyValue} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                      />
                      
                      {onPredict && (
                        <Tooltip title="Predict property from this image">
                          <Button
                            size="small"
                            onClick={() => handlePredict(reference.imagePath)}
                            disabled={predicting}
                            startIcon={predicting ? <CircularProgress size={16} /> : null}
                          >
                            Predict
                          </Button>
                        </Tooltip>
                      )}
                    </Box>
                    
                    {prediction && selectedImage === reference.imagePath && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" display="block">
                          Predicted: {prediction.value} ({(prediction.confidence * 100).toFixed(1)}%)
                        </Typography>
                        
                        {prediction.alternatives && prediction.alternatives.length > 0 && (
                          <Typography variant="caption" display="block" color="textSecondary">
                            Alternatives: {prediction.alternatives.map((alt: any) => 
                              `${alt.value} (${(alt.confidence * 100).toFixed(1)}%)`
                            ).join(', ')}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default PropertyVisualReference;
