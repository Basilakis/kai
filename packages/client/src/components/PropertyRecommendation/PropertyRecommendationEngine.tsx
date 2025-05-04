import React, { useState } from 'react';
import { Box, Typography, Divider } from '@mui/material';
import PropertyRecommendationForm from './PropertyRecommendationForm';
import PropertyRecommendationResults from './PropertyRecommendationResults';
import { PropertyRecommendationResult } from '../../services/propertyRecommendationService';
import { MaterialComparisonDialog } from '../MaterialComparison';

interface PropertyRecommendationEngineProps {
  projectId?: string;
  initialMaterialType?: string;
  onMaterialSelect?: (materialId: string) => void;
}

const PropertyRecommendationEngine: React.FC<PropertyRecommendationEngineProps> = ({
  projectId,
  initialMaterialType,
  onMaterialSelect
}) => {
  const [recommendations, setRecommendations] = useState<PropertyRecommendationResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState<boolean>(false);
  const [materialsToCompare, setMaterialsToCompare] = useState<string[]>([]);
  
  // Handle recommendations received
  const handleRecommendationsReceived = (results: PropertyRecommendationResult[]) => {
    setRecommendations(results);
    setShowResults(true);
  };
  
  // Handle material selection
  const handleMaterialSelect = (materialId: string) => {
    if (onMaterialSelect) {
      onMaterialSelect(materialId);
    }
  };
  
  // Handle compare materials
  const handleCompareMaterials = (materialIds: string[]) => {
    setMaterialsToCompare(materialIds);
    setComparisonDialogOpen(true);
  };
  
  // Handle close comparison dialog
  const handleCloseComparisonDialog = () => {
    setComparisonDialogOpen(false);
  };
  
  return (
    <Box>
      <PropertyRecommendationForm
        onRecommendationsReceived={handleRecommendationsReceived}
        projectId={projectId}
        initialMaterialType={initialMaterialType}
      />
      
      {showResults && recommendations.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          
          <PropertyRecommendationResults
            recommendations={recommendations}
            onMaterialSelect={handleMaterialSelect}
            onCompare={handleCompareMaterials}
          />
        </>
      )}
      
      {/* Material Comparison Dialog */}
      <MaterialComparisonDialog
        open={comparisonDialogOpen}
        onClose={handleCloseComparisonDialog}
        initialMaterialIds={materialsToCompare}
      />
    </Box>
  );
};

export default PropertyRecommendationEngine;
