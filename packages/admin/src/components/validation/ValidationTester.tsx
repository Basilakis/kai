import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import { useAuth } from '../../../client/src/hooks/useAuth';
import { ValidationSeverity } from '@kai/shared/src/types/validation';

interface ValidationTesterProps {
  rule: any;
  materialType: string;
}

/**
 * Validation Tester Component
 * 
 * Component for testing validation rules with sample values.
 */
const ValidationTester: React.FC<ValidationTesterProps> = ({
  rule,
  materialType
}) => {
  const { token } = useAuth();
  const [value, setValue] = useState<string>('');
  const [otherProperties, setOtherProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle value change
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  // Handle other property change
  const handleOtherPropertyChange = (propertyName: string, value: string) => {
    setOtherProperties(prev => ({
      ...prev,
      [propertyName]: value
    }));
  };

  // Handle test
  const handleTest = async () => {
    try {
      setLoading(true);
      setError(null);
      setResults(null);

      const response = await fetch('/api/validation/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          propertyName: rule.propertyName,
          value,
          materialType,
          otherProperties
        })
      });

      if (!response.ok) {
        throw new Error('Failed to validate property');
      }

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Get severity color
  const getSeverityColor = (severity: ValidationSeverity) => {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return 'error';
      case ValidationSeverity.WARNING:
        return 'warning';
      case ValidationSeverity.INFO:
        return 'info';
      default:
        return 'success';
    }
  };

  // Determine if we need to show other properties input
  const needsOtherProperties = rule.type === 'dependency';

  // Get dependent property name if this is a dependency rule
  const dependentPropertyName = rule.type === 'dependency' ? rule.condition?.propertyName : null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        Test Rule: {rule.name}
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            label={`Value for ${rule.propertyName}`}
            fullWidth
            value={value}
            onChange={handleValueChange}
            placeholder="Enter a value to test"
          />
        </Grid>

        {needsOtherProperties && dependentPropertyName && (
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Dependent Properties
            </Typography>
            <TextField
              label={dependentPropertyName}
              fullWidth
              value={otherProperties[dependentPropertyName] || ''}
              onChange={(e) => handleOtherPropertyChange(dependentPropertyName, e.target.value)}
              placeholder={`Enter value for ${dependentPropertyName}`}
            />
          </Grid>
        )}

        <Grid item xs={12}>
          <Button
            variant="contained"
            onClick={handleTest}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={24} /> : null}
          >
            Test Validation
          </Button>
        </Grid>

        {error && (
          <Grid item xs={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}

        {results && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Validation Results
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {results.map((result, index) => (
                <Alert
                  key={index}
                  severity={result.isValid ? 'success' : getSeverityColor(result.severity)}
                  sx={{ mb: 1 }}
                >
                  <Typography variant="subtitle2">
                    {result.isValid ? 'Validation Passed' : 'Validation Failed'}
                  </Typography>
                  {!result.isValid && result.message && (
                    <Typography variant="body2">
                      {result.message}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ValidationTester;
