import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayArrowIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import {
  ValidationRuleType,
  ValidationSeverity
} from '@kai/shared/src/types/validation';

interface ValidationRuleDetailsProps {
  rule: any;
  allRules: any[];
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}

/**
 * Validation Rule Details Component
 * 
 * Displays detailed information about a validation rule.
 */
const ValidationRuleDetails: React.FC<ValidationRuleDetailsProps> = ({
  rule,
  allRules,
  onEdit,
  onDelete,
  onTest
}) => {
  // Get severity icon
  const getSeverityIcon = (severity: ValidationSeverity) => {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return <ErrorIcon color="error" />;
      case ValidationSeverity.WARNING:
        return <WarningIcon color="warning" />;
      case ValidationSeverity.INFO:
        return <InfoIcon color="info" />;
      default:
        return null;
    }
  };

  // Get rule type display name
  const getRuleTypeDisplayName = (type: ValidationRuleType) => {
    switch (type) {
      case ValidationRuleType.RANGE:
        return 'Range';
      case ValidationRuleType.PATTERN:
        return 'Pattern';
      case ValidationRuleType.ENUM:
        return 'Enumeration';
      case ValidationRuleType.DEPENDENCY:
        return 'Dependency';
      case ValidationRuleType.CUSTOM:
        return 'Custom';
      case ValidationRuleType.COMPOSITE:
        return 'Composite';
      default:
        return type;
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {rule.name}
          </Typography>
          <Chip
            label={rule.isActive ? 'Active' : 'Inactive'}
            color={rule.isActive ? 'success' : 'default'}
            size="small"
          />
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Property
            </Typography>
            <Typography variant="body1">
              {rule.propertyName}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Material Type
            </Typography>
            <Typography variant="body1">
              {rule.materialType}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Type
            </Typography>
            <Typography variant="body1">
              {getRuleTypeDisplayName(rule.type)}
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Severity
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {getSeverityIcon(rule.severity)}
              <Typography variant="body1" sx={{ ml: 1 }}>
                {rule.severity}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary">
              Error Message
            </Typography>
            <Typography variant="body1">
              {rule.message}
            </Typography>
          </Grid>
          
          {rule.description && (
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">
                {rule.description}
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Rule Configuration
        </Typography>
        
        <Divider sx={{ mb: 2 }} />
        
        {rule.type === ValidationRuleType.RANGE && (
          <Grid container spacing={2}>
            {rule.min !== undefined && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Minimum Value
                </Typography>
                <Typography variant="body1">
                  {rule.min}
                </Typography>
              </Grid>
            )}
            
            {rule.max !== undefined && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Maximum Value
                </Typography>
                <Typography variant="body1">
                  {rule.max}
                </Typography>
              </Grid>
            )}
            
            {rule.step !== undefined && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Step
                </Typography>
                <Typography variant="body1">
                  {rule.step}
                </Typography>
              </Grid>
            )}
            
            {rule.unit && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Unit
                </Typography>
                <Typography variant="body1">
                  {rule.unit}
                </Typography>
              </Grid>
            )}
          </Grid>
        )}
        
        {rule.type === ValidationRuleType.PATTERN && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Pattern
              </Typography>
              <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                {rule.pattern}
              </Typography>
            </Grid>
            
            {rule.flags && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Flags
                </Typography>
                <Typography variant="body1">
                  {rule.flags}
                </Typography>
              </Grid>
            )}
          </Grid>
        )}
        
        {rule.type === ValidationRuleType.ENUM && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Allowed Values
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {rule.allowedValues.map((value: string) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            </Grid>
          </Grid>
        )}
        
        {rule.type === ValidationRuleType.DEPENDENCY && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Condition
              </Typography>
              <Box sx={{ bgcolor: 'background.default', p: 1, borderRadius: 1, mt: 1 }}>
                <Typography variant="body2">
                  When <strong>{rule.condition.propertyName}</strong> {rule.condition.operator} {rule.condition.value !== undefined ? <strong>{JSON.stringify(rule.condition.value)}</strong> : ''}
                </Typography>
              </Box>
            </Grid>
            
            {rule.requiredValue !== undefined && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required Value
                </Typography>
                <Typography variant="body1">
                  {JSON.stringify(rule.requiredValue)}
                </Typography>
              </Grid>
            )}
            
            {rule.requiredPattern && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required Pattern
                </Typography>
                <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                  {rule.requiredPattern}
                </Typography>
              </Grid>
            )}
            
            {rule.requiredRange && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required Range
                </Typography>
                <Typography variant="body1">
                  {rule.requiredRange.min !== undefined ? `Min: ${rule.requiredRange.min}` : ''}
                  {rule.requiredRange.min !== undefined && rule.requiredRange.max !== undefined ? ', ' : ''}
                  {rule.requiredRange.max !== undefined ? `Max: ${rule.requiredRange.max}` : ''}
                </Typography>
              </Grid>
            )}
          </Grid>
        )}
        
        {rule.type === ValidationRuleType.CUSTOM && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Function Name
              </Typography>
              <Typography variant="body1">
                {rule.functionName}
              </Typography>
            </Grid>
            
            {rule.parameters && Object.keys(rule.parameters).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary">
                  Parameters
                </Typography>
                <Typography variant="body1" component="pre" sx={{ fontFamily: 'monospace', bgcolor: 'background.default', p: 1, borderRadius: 1 }}>
                  {JSON.stringify(rule.parameters, null, 2)}
                </Typography>
              </Grid>
            )}
          </Grid>
        )}
        
        {rule.type === ValidationRuleType.COMPOSITE && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Operator
              </Typography>
              <Typography variant="body1">
                {rule.operator}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Referenced Rules
              </Typography>
              <List dense>
                {rule.rules.map((ruleId: string) => {
                  const referencedRule = allRules.find(r => r.id === ruleId);
                  return (
                    <ListItem key={ruleId}>
                      <ListItemText
                        primary={referencedRule ? referencedRule.name : ruleId}
                        secondary={referencedRule ? `${referencedRule.propertyName} - ${getRuleTypeDisplayName(referencedRule.type)}` : 'Rule not found'}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Grid>
          </Grid>
        )}
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<PlayArrowIcon />}
          onClick={onTest}
        >
          Test Rule
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={onEdit}
        >
          Edit Rule
        </Button>
        
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={onDelete}
        >
          Delete Rule
        </Button>
      </Box>
    </Box>
  );
};

export default ValidationRuleDetails;
