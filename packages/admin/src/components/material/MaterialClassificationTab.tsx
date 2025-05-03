import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { useAuth } from '../../../client/src/hooks/useAuth';
import MaterialClassificationManager from '../../../client/src/components/classification/MaterialClassificationManager';

interface MaterialClassificationTabProps {
  materialId: string;
  materialName?: string;
}

/**
 * Material Classification Tab
 * 
 * Tab for managing material classifications in the material detail page.
 */
const MaterialClassificationTab: React.FC<MaterialClassificationTabProps> = ({
  materialId,
  materialName
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleClassificationChange = () => {
    // Refresh the component
    setRefreshKey(prev => prev + 1);
  };

  return (
    <Box sx={{ p: 2 }} key={refreshKey}>
      <Typography variant="h6" gutterBottom>
        Material Classifications
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <MaterialClassificationManager
          materialId={materialId}
          materialName={materialName}
          onClassificationChange={handleClassificationChange}
        />
      )}
    </Box>
  );
};

export default MaterialClassificationTab;
