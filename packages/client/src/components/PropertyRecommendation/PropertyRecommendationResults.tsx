import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Chip,
  Button,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Info as InfoIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CompareArrows as CompareArrowsIcon
} from '@mui/icons-material';
import { PropertyRecommendationResult } from '../../services/propertyRecommendationService';

interface PropertyRecommendationResultsProps {
  recommendations: PropertyRecommendationResult[];
  onMaterialSelect?: (materialId: string) => void;
  onCompare?: (materialIds: string[]) => void;
}

const PropertyRecommendationResults: React.FC<PropertyRecommendationResultsProps> = ({
  recommendations,
  onMaterialSelect,
  onCompare
}) => {
  const theme = useTheme();
  const [selectedMaterial, setSelectedMaterial] = useState<PropertyRecommendationResult | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  
  // Handle material selection
  const handleMaterialSelect = (material: PropertyRecommendationResult) => {
    if (onMaterialSelect) {
      onMaterialSelect(material.materialId);
    }
  };
  
  // Handle detail dialog open
  const handleOpenDetailDialog = (material: PropertyRecommendationResult) => {
    setSelectedMaterial(material);
    setDetailDialogOpen(true);
  };
  
  // Handle detail dialog close
  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedMaterial(null);
  };
  
  // Handle toggle material for comparison
  const handleToggleForComparison = (materialId: string) => {
    if (selectedForComparison.includes(materialId)) {
      setSelectedForComparison(selectedForComparison.filter(id => id !== materialId));
    } else {
      if (selectedForComparison.length < 3) {
        setSelectedForComparison([...selectedForComparison, materialId]);
      }
    }
  };
  
  // Handle compare selected materials
  const handleCompareSelected = () => {
    if (onCompare && selectedForComparison.length >= 2) {
      onCompare(selectedForComparison);
    }
  };
  
  // Get relevance score color
  const getRelevanceScoreColor = (score: number) => {
    if (score >= 0.8) {
      return theme.palette.success.main;
    } else if (score >= 0.6) {
      return theme.palette.warning.main;
    } else {
      return theme.palette.error.main;
    }
  };
  
  // Format property value
  const formatPropertyValue = (value: any) => {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    return value.toString();
  };
  
  // Get property display name
  const getPropertyDisplayName = (propertyName: string) => {
    const parts = propertyName.split('.');
    const lastPart = parts[parts.length - 1];
    
    return lastPart
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
  };
  
  if (recommendations.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="textSecondary">
          No recommendations found.
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Try adjusting your property requirements or project context.
        </Typography>
      </Paper>
    );
  }
  
  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            Recommended Materials
          </Typography>
          {onCompare && (
            <Button
              variant="outlined"
              startIcon={<CompareArrowsIcon />}
              onClick={handleCompareSelected}
              disabled={selectedForComparison.length < 2}
            >
              Compare Selected ({selectedForComparison.length})
            </Button>
          )}
        </Box>
        
        <Grid container spacing={3}>
          {recommendations.map((recommendation) => (
            <Grid item xs={12} sm={6} md={4} key={recommendation.materialId}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardActionArea onClick={() => handleMaterialSelect(recommendation)}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={`https://source.unsplash.com/random/300x200/?${recommendation.materialType}`}
                    alt={recommendation.materialName}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Typography variant="h6" component="div">
                        {recommendation.materialName}
                      </Typography>
                      <Chip
                        label={`${Math.round(recommendation.relevanceScore * 100)}%`}
                        size="small"
                        sx={{
                          bgcolor: getRelevanceScoreColor(recommendation.relevanceScore),
                          color: 'white'
                        }}
                      />
                    </Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      {recommendation.materialType}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {recommendation.matchReason}
                    </Typography>
                    
                    {recommendation.complementaryWith && recommendation.complementaryWith.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="primary">
                          Complementary with {recommendation.complementaryWith.length} existing materials
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
                <Divider />
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    startIcon={<InfoIcon />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDetailDialog(recommendation);
                    }}
                  >
                    Details
                  </Button>
                  
                  {onCompare && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleForComparison(recommendation.materialId);
                      }}
                      color={selectedForComparison.includes(recommendation.materialId) ? 'primary' : 'default'}
                    >
                      {selectedForComparison.includes(recommendation.materialId) ? (
                        <StarIcon />
                      ) : (
                        <StarBorderIcon />
                      )}
                    </IconButton>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>
      
      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={handleCloseDetailDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedMaterial?.materialName}
            </Typography>
            <Chip
              label={`${Math.round((selectedMaterial?.relevanceScore || 0) * 100)}% Match`}
              size="small"
              sx={{
                bgcolor: getRelevanceScoreColor(selectedMaterial?.relevanceScore || 0),
                color: 'white'
              }}
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body1" paragraph>
            {selectedMaterial?.matchReason}
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom>
            Property Matches
          </Typography>
          
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell>Requested Value</TableCell>
                  <TableCell>Actual Value</TableCell>
                  <TableCell>Match Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedMaterial?.propertyMatches?.map((match) => (
                  <TableRow key={match.propertyName}>
                    <TableCell>
                      {getPropertyDisplayName(match.propertyName)}
                    </TableCell>
                    <TableCell>
                      {formatPropertyValue(match.requestedValue)}
                    </TableCell>
                    <TableCell>
                      {formatPropertyValue(match.actualValue)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {Math.round(match.matchScore * 100)}%
                        </Typography>
                        {match.matchScore >= 0.8 ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : match.matchScore >= 0.5 ? (
                          <WarningIcon color="warning" fontSize="small" />
                        ) : (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={handleCloseDetailDialog}>Close</Button>
          {onMaterialSelect && (
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                handleCloseDetailDialog();
                if (selectedMaterial) {
                  handleMaterialSelect(selectedMaterial);
                }
              }}
            >
              Select Material
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PropertyRecommendationResults;
