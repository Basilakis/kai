import * as React from 'react';
import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Tooltip,
  Typography
} from './mui';
import {
  Collections as CollectionsIcon,
  PhotoLibrary as PhotoLibraryIcon
} from './mui-icons';
import PropertyReferenceGallery from './PropertyReferenceGallery';
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
        <PropertyReferenceGallery
          propertyName={propertyName}
          propertyValue={propertyValue}
          materialType={materialType}
          onClose={handleClose}
          readOnly={readOnly}
        />
      </Dialog>
    </>
  );
};

export default PropertyReferenceButton;
