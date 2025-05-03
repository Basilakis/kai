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
  AccountTree as AccountTreeIcon,
  Recommend as RecommendIcon
} from './mui-icons';
import { propertyRelationshipService } from '@kai/shared/src/services/property-relationships/propertyRelationshipService';

interface PropertyRelationshipButtonProps {
  propertyName: string;
  propertyValue: string;
  materialType: string;
  metadata: Record<string, any>;
  onRecommendationSelect?: (propertyName: string, value: string) => void;
  variant?: 'button' | 'icon';
  size?: 'small' | 'medium' | 'large';
}

/**
 * Button component that shows property relationship recommendations
 */
const PropertyRelationshipButton: React.FC<PropertyRelationshipButtonProps> = ({
  propertyName,
  propertyValue,
  materialType,
  metadata,
  onRecommendationSelect,
  variant = 'icon',
  size = 'small'
}) => {
  const [open, setOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get recommendations when the dialog opens
  const getRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/property-relationships/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          materialType,
          properties: metadata,
          targetProperty: propertyName
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to get recommendations');
      }
      
      const data = await response.json();
      
      if (data.success && data.result && data.result.recommendations) {
        setRecommendations(data.result.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle button click
  const handleClick = () => {
    setOpen(true);
    getRecommendations();
  };

  // Handle dialog close
  const handleClose = () => {
    setOpen(false);
  };

  // Handle recommendation selection
  const handleRecommendationSelect = (value: string) => {
    if (onRecommendationSelect) {
      onRecommendationSelect(propertyName, value);
    }
    handleClose();
  };

  return (
    <>
      {variant === 'button' ? (
        <Button
          startIcon={<RecommendIcon />}
          size={size}
          onClick={handleClick}
          color="primary"
          variant="outlined"
        >
          Recommendations
        </Button>
      ) : (
        <Tooltip title="Get Recommendations">
          <IconButton
            size={size}
            onClick={handleClick}
            color="primary"
          >
            <RecommendIcon />
          </IconButton>
        </Tooltip>
      )}

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" component="h2">
              Recommendations for {propertyName}
            </Typography>
            <IconButton onClick={handleClose}>
              <AccountTreeIcon />
            </IconButton>
          </Box>

          {error && (
            <Typography color="error" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <Typography>Loading recommendations...</Typography>
            </Box>
          ) : recommendations.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body1">
                No recommendations available for this property.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This could be because there are no defined relationships for this property
                or the current property values don't have any strong correlations.
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Based on your current selections, we recommend the following values for {propertyName}:
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {recommendations.map((rec, index) => (
                  <Button
                    key={index}
                    variant={rec.value === propertyValue ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={() => handleRecommendationSelect(rec.value)}
                    sx={{ justifyContent: 'space-between' }}
                  >
                    <Typography>{rec.value}</Typography>
                    <Typography variant="caption" sx={{ ml: 2 }}>
                      {Math.round(rec.confidence * 100)}% match
                    </Typography>
                  </Button>
                ))}
              </Box>
              
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" color="text.secondary">
                  These recommendations are based on property relationships defined in the system.
                  Visit the Property Relationships page to manage these relationships.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Dialog>
    </>
  );
};

export default PropertyRelationshipButton;
