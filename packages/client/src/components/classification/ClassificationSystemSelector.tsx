import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { ClassificationSystem } from '@kai/shared/src/types/classification';
import { useAuth } from '../../hooks/useAuth';

interface ClassificationSystemSelectorProps {
  onSystemSelect: (system: ClassificationSystem) => void;
  selectedSystemId?: string;
  label?: string;
  size?: 'small' | 'medium';
}

/**
 * Classification System Selector Component
 * 
 * Allows users to select a classification system.
 */
const ClassificationSystemSelector: React.FC<ClassificationSystemSelectorProps> = ({
  onSystemSelect,
  selectedSystemId,
  label = 'Classification System',
  size = 'medium'
}) => {
  const { token } = useAuth();
  const [systems, setSystems] = useState<ClassificationSystem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClassificationSystems = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/classification/systems', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch classification systems');
        }
        
        const data = await response.json();
        
        if (data.success && data.systems) {
          setSystems(data.systems);
          
          // If no system is selected and we have systems, select the first one
          if (!selectedSystemId && data.systems.length > 0 && onSystemSelect) {
            onSystemSelect(data.systems[0]);
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchClassificationSystems();
  }, [token, selectedSystemId, onSystemSelect]);

  const handleSystemChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const systemId = event.target.value as string;
    const selectedSystem = systems.find(system => system.id === systemId);
    
    if (selectedSystem && onSystemSelect) {
      onSystemSelect(selectedSystem);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CircularProgress size={24} sx={{ mr: 1 }} />
        <Typography variant="body2">Loading classification systems...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (systems.length === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No classification systems available.
      </Alert>
    );
  }

  return (
    <FormControl fullWidth size={size}>
      <InputLabel id="classification-system-label">{label}</InputLabel>
      <Select
        labelId="classification-system-label"
        id="classification-system"
        value={selectedSystemId || ''}
        label={label}
        onChange={handleSystemChange as any}
      >
        {systems.map((system) => (
          <MenuItem key={system.id} value={system.id}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1">{system.name}</Typography>
                {system.version && (
                  <Chip
                    label={`v${system.version}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              {system.description && (
                <Typography variant="caption" color="text.secondary">
                  {system.description}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ClassificationSystemSelector;
