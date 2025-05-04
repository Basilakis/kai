import * as React from 'react';
import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Tooltip,
  Typography,
  Tab,
  Tabs
} from './mui';
import {
  Collections as CollectionsIcon,
  PhotoLibrary as PhotoLibraryIcon,
  AutoAwesome as AutoAwesomeIcon
} from './mui-icons';
import PropertyReferenceGallery from './PropertyReferenceGallery';
import PropertyVisualReference from '../../client/src/components/materials/PropertyVisualReference';
import { propertyReferenceService } from '@kai/shared/src/services/property-reference/propertyReferenceService';

interface PropertyReferenceButtonProps {
  propertyName: string;
  propertyValue: string;
  materialType: string;
  variant?: 'button' | 'icon';
  size?: 'small' | 'medium' | 'large';
  readOnly?: boolean;
}

/**
 * Button component that opens a dialog with property reference images
 */
const PropertyReferenceButton: React.FC<PropertyReferenceButtonProps> = ({
  propertyName,
  propertyValue,
  materialType,
  variant = 'icon',
  size = 'small',
  readOnly = false
}) => {
  const [open, setOpen] = useState(false);
  const [hasImages, setHasImages] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [prediction, setPrediction] = useState<any | null>(null);

  // Check if there are any images for this property value
  const checkForImages = async () => {
    if (hasImages !== null) return;

    try {
      setLoading(true);
      const images = await propertyReferenceService.getPropertyReferenceImages({
        propertyName,
        propertyValue,
        materialType
      });
      setHasImages(images.length > 0);
    } catch (error) {
      console.error('Failed to check for images', error);
      setHasImages(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle button click
  const handleClick = () => {
    setOpen(true);
  };

  // Handle dialog close
  const handleClose = () => {
    setOpen(false);
    setPrediction(null);
  };

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Handle prediction
  const handlePredict = (predictionResult: any) => {
    setPrediction(predictionResult);
  };

  // Check for images when the component mounts or when dependencies change
  React.useEffect(() => {
    if (propertyValue) {
      checkForImages();
    } else {
      setHasImages(null);
    }
  }, [propertyName, propertyValue, materialType]);

  if (!propertyValue) return null;

  return (
    <>
      {variant === 'button' ? (
        <Button
          startIcon={hasImages ? <PhotoLibraryIcon /> : <CollectionsIcon />}
          size={size}
          onClick={handleClick}
          disabled={loading}
          color={hasImages ? 'primary' : 'inherit'}
          variant={hasImages ? 'contained' : 'outlined'}
        >
          {hasImages ? 'View Examples' : 'Add Examples'}
        </Button>
      ) : (
        <Tooltip title={hasImages ? 'View Examples' : 'Add Examples'}>
          <IconButton
            size={size}
            onClick={handleClick}
            disabled={loading}
            color={hasImages ? 'primary' : 'inherit'}
          >
            {hasImages ? <PhotoLibraryIcon /> : <CollectionsIcon />}
          </IconButton>
        </Tooltip>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Visual References for {propertyName}: {propertyValue}
            </Typography>
            <IconButton onClick={handleClose}>
              <CollectionsIcon />
            </IconButton>
          </Box>

          {prediction && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" gutterBottom>
                <AutoAwesomeIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                AI Prediction
              </Typography>
              <Typography variant="body1">
                Predicted value: <strong>{prediction.value}</strong> (Confidence: {(prediction.confidence * 100).toFixed(1)}%)
              </Typography>
              {prediction.alternatives && prediction.alternatives.length > 0 && (
                <Typography variant="body2" color="textSecondary">
                  Alternatives: {prediction.alternatives.map((alt: any) =>
                    `${alt.value} (${(alt.confidence * 100).toFixed(1)}%)`
                  ).join(', ')}
                </Typography>
              )}
            </Box>
          )}

          <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab label="Gallery" />
            <Tab label="Visual Reference Library" />
          </Tabs>

          {activeTab === 0 ? (
            <PropertyReferenceGallery
              propertyName={propertyName}
              propertyValue={propertyValue}
              materialType={materialType}
              readOnly={readOnly}
            />
          ) : (
            <PropertyVisualReference
              propertyName={propertyName}
              propertyValue={propertyValue}
              materialType={materialType as MaterialType}
              showTitle={false}
              maxItems={12}
              onPredict={handlePredict}
            />
          )}
        </Box>
      </Dialog>
    </>
  );
};

export default PropertyReferenceButton;
