import React from 'react';
import {
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  ListItemIcon,
  Paper
} from '@mui/material';
import { ValidationLogicalOperator, ValidationRuleType } from '@kai/shared/src/types/validation';

interface CompositeValidationFieldsProps {
  data: {
    operator: string;
    rules: string[];
  };
  onChange: (data: any) => void;
  errors: Record<string, string>;
  existingRules: any[];
}

/**
 * Composite Validation Fields Component
 * 
 * Form fields specific to composite validation rules.
 */
const CompositeValidationFields: React.FC<CompositeValidationFieldsProps> = ({
  data,
  onChange,
  errors,
  existingRules
}) => {
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

  // Handle operator change
  const handleOperatorChange = (e: React.ChangeEvent<{ name?: string; value: unknown }>) => {
    onChange({
      ...data,
      operator: e.target.value as string
    });
  };

  // Handle rule selection
  const handleRuleToggle = (ruleId: string) => {
    const currentRules = [...data.rules];
    const currentIndex = currentRules.indexOf(ruleId);
    
    if (currentIndex === -1) {
      // Add rule
      currentRules.push(ruleId);
    } else {
      // Remove rule
      currentRules.splice(currentIndex, 1);
    }
    
    onChange({
      ...data,
      rules: currentRules
    });
  };

  // Filter out composite rules to prevent circular references
  // Also filter out the current rule if editing
  const availableRules = existingRules.filter(rule => 
    rule.type !== ValidationRuleType.COMPOSITE
  );

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <FormControl fullWidth required error={!!errors.operator}>
          <InputLabel>Logical Operator</InputLabel>
          <Select
            value={data.operator}
            onChange={handleOperatorChange}
            label="Logical Operator"
          >
            <MenuItem value={ValidationLogicalOperator.AND}>AND (All rules must pass)</MenuItem>
            <MenuItem value={ValidationLogicalOperator.OR}>OR (At least one rule must pass)</MenuItem>
            <MenuItem value={ValidationLogicalOperator.NOT}>NOT (Rule must fail)</MenuItem>
          </Select>
          {errors.operator && (
            <FormHelperText>{errors.operator}</FormHelperText>
          )}
        </FormControl>
        
        {data.operator === ValidationLogicalOperator.NOT && (
          <FormHelperText>
            Note: NOT operator typically applies to a single rule. Only the first selected rule will be used.
          </FormHelperText>
        )}
      </Grid>
      
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Select Rules to Include
        </Typography>
        
        {errors.rules && (
          <FormHelperText error sx={{ mb: 1 }}>{errors.rules}</FormHelperText>
        )}
        
        {availableRules.length === 0 ? (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2">
              No rules available. Create some non-composite rules first.
            </Typography>
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
            <List dense>
              {availableRules.map(rule => (
                <ListItem
                  key={rule.id}
                  button
                  onClick={() => handleRuleToggle(rule.id)}
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={data.rules.includes(rule.id)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={rule.name}
                    secondary={`${rule.propertyName} - ${getRuleTypeDisplayName(rule.type)}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Grid>
      
      {data.rules.length > 0 && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Rules
          </Typography>
          <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
            <List dense>
              {data.rules.map(ruleId => {
                const rule = existingRules.find(r => r.id === ruleId);
                return (
                  <ListItem key={ruleId}>
                    <ListItemText
                      primary={rule ? rule.name : `Rule ID: ${ruleId}`}
                      secondary={rule ? `${rule.propertyName} - ${getRuleTypeDisplayName(rule.type)}` : 'Rule not found'}
                    />
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Grid>
      )}
    </Grid>
  );
};

export default CompositeValidationFields;
