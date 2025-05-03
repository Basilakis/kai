import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Typography
} from './mui';
import { CompatibilityType } from '@kai/shared/src/types/property-relationships';

interface PropertyValidationAlertProps {
  materialType: string;
  metadata: Record<string, any>;
  onRecommendationApply?: (propertyName: string, value: string) => void;
}

/**
 * Component that validates property combinations and shows alerts for incompatible properties
 */
const PropertyValidationAlert: React.FC<PropertyValidationAlertProps> = ({
  materialType,
  metadata,
  onRecommendationApply
}) => {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Validate properties when metadata changes
  useEffect(() => {
    const validateProperties = async () => {
      // Skip validation if metadata is empty
      if (!metadata || Object.keys(metadata).length === 0) {
        setValidationResult(null);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/property-relationships/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            materialType,
            properties: metadata
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to validate properties');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setValidationResult(data.result);
        } else {
          setValidationResult(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
        setValidationResult(null);
      } finally {
        setLoading(false);
      }
    };
    
    validateProperties();
  }, [materialType, metadata]);

  // Handle recommendation apply
  const handleRecommendationApply = (propertyName: string, value: string) => {
    if (onRecommendationApply) {
      onRecommendationApply(propertyName, value);
    }
  };

  // If no validation result or no issues, don't show anything
  if (loading || !validationResult || (!validationResult.issues && !validationResult.recommendations)) {
    return null;
  }

  // Get incompatible issues
  const incompatibleIssues = validationResult.issues?.filter(
    (issue: any) => issue.compatibilityType === CompatibilityType.INCOMPATIBLE
  ) || [];

  // Get not recommended issues
  const notRecommendedIssues = validationResult.issues?.filter(
    (issue: any) => issue.compatibilityType === CompatibilityType.NOT_RECOMMENDED
  ) || [];

  // Get recommendations
  const recommendations = validationResult.recommendations || [];

  return (
    <Box sx={{ mb: 3 }}>
      {incompatibleIssues.length > 0 && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setExpanded(!expanded)}
        >
          <AlertTitle>Incompatible Property Combinations</AlertTitle>
          <Collapse in={expanded}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              The following property combinations are incompatible:
            </Typography>
            <List dense disablePadding>
              {incompatibleIssues.map((issue: any, index: number) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={`${issue.sourceProperty}="${issue.sourceValue}" is incompatible with ${issue.targetProperty}="${issue.targetValue}"`}
                    secondary={issue.reason}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}

      {notRecommendedIssues.length > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 2 }}
          onClose={() => setExpanded(!expanded)}
        >
          <AlertTitle>Not Recommended Property Combinations</AlertTitle>
          <Collapse in={expanded}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              The following property combinations are not recommended:
            </Typography>
            <List dense disablePadding>
              {notRecommendedIssues.map((issue: any, index: number) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={`${issue.sourceProperty}="${issue.sourceValue}" is not recommended with ${issue.targetProperty}="${issue.targetValue}"`}
                    secondary={issue.reason}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}

      {recommendations.length > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 2 }}
          onClose={() => setExpanded(!expanded)}
        >
          <AlertTitle>Recommended Property Values</AlertTitle>
          <Collapse in={expanded}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Based on your current selections, we recommend the following property values:
            </Typography>
            <List dense disablePadding>
              {recommendations.map((rec: any, index: number) => (
                <ListItem 
                  key={index} 
                  disablePadding
                  secondaryAction={
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => handleRecommendationApply(rec.property, rec.recommendedValue)}
                    >
                      Apply
                    </Button>
                  }
                >
                  <ListItemText
                    primary={`${rec.property}: "${rec.recommendedValue}" (${Math.round(rec.confidence * 100)}% confidence)`}
                    secondary={rec.reason}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Alert>
      )}
    </Box>
  );
};

export default PropertyValidationAlert;
