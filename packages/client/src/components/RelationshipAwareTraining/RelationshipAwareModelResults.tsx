import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { RelationshipType } from '@kai/shared/src/types/property-relationships';

interface RelationshipAwareModelResultsProps {
  result: {
    modelId: string;
    targetProperty: string;
    materialType: string;
    accuracy: number;
    validationAccuracy: number;
    baselineAccuracy?: number;
    improvementPercentage?: number;
    featureImportance?: Record<string, number>;
    relationshipMetrics?: {
      relationshipsUsed: number;
      relationshipContribution: number;
      mostInfluentialRelationships: Array<{
        sourceProperty: string;
        targetProperty: string;
        relationshipType: RelationshipType;
        importance: number;
      }>;
    };
  };
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

const RelationshipAwareModelResults: React.FC<RelationshipAwareModelResultsProps> = ({
  result
}) => {
  // Format property name for display
  const formatPropertyName = (property: string) => {
    const parts = property.split('.');
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };
  
  // Format relationship type for display
  const formatRelationshipType = (type: RelationshipType) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
  };
  
  // Prepare feature importance data for chart
  const prepareFeatureImportanceData = () => {
    if (!result.featureImportance) {
      return [];
    }
    
    // Get top 10 features by importance
    const sortedFeatures = Object.entries(result.featureImportance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    return sortedFeatures.map(([feature, importance]) => ({
      name: feature.startsWith('rel_')
        ? `${feature.split('_')[1]} (${feature.split('_').slice(2).join('_')})`
        : formatPropertyName(feature),
      value: importance,
      isRelationship: feature.startsWith('rel_')
    }));
  };
  
  // Prepare relationship contribution data for pie chart
  const prepareRelationshipContributionData = () => {
    if (!result.relationshipMetrics || !result.baselineAccuracy) {
      return [];
    }
    
    const relationshipContribution = result.relationshipMetrics.relationshipContribution;
    const baseContribution = result.baselineAccuracy;
    
    return [
      { name: 'Base Features', value: baseContribution },
      { name: 'Relationship Features', value: relationshipContribution }
    ];
  };
  
  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Relationship-Aware Model Results
          </Typography>
          
          <Grid container spacing={3}>
            {/* Model Information */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Model Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Model ID
                    </Typography>
                    <Typography variant="body1">
                      {result.modelId}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Material Type
                    </Typography>
                    <Typography variant="body1">
                      {result.materialType.charAt(0).toUpperCase() + result.materialType.slice(1)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Typography variant="body2" color="textSecondary">
                      Target Property
                    </Typography>
                    <Typography variant="body1">
                      {formatPropertyName(result.targetProperty)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            
            {/* Performance Metrics */}
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Performance Metrics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">
                      Accuracy
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {(result.accuracy * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="textSecondary">
                      Validation Accuracy
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {(result.validationAccuracy * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  {result.baselineAccuracy && (
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        Baseline Accuracy
                      </Typography>
                      <Typography variant="h6">
                        {(result.baselineAccuracy * 100).toFixed(2)}%
                      </Typography>
                    </Grid>
                  )}
                  {result.improvementPercentage && (
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2" color="textSecondary">
                        Improvement
                      </Typography>
                      <Typography variant="h6" color="success.main">
                        +{result.improvementPercentage.toFixed(2)}%
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </Grid>
            
            {/* Relationship Metrics */}
            {result.relationshipMetrics && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Relationship Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={4}>
                      <Typography variant="body2" color="textSecondary">
                        Relationships Used
                      </Typography>
                      <Typography variant="h6">
                        {result.relationshipMetrics.relationshipsUsed}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={4}>
                      <Typography variant="body2" color="textSecondary">
                        Relationship Contribution
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {(result.relationshipMetrics.relationshipContribution * 100).toFixed(2)}%
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  {/* Relationship Contribution Chart */}
                  <Typography variant="subtitle2" gutterBottom>
                    Contribution to Model Performance
                  </Typography>
                  <Box height={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prepareRelationshipContributionData()}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {prepareRelationshipContributionData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [(value * 100).toFixed(2) + '%', 'Contribution']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            )}
            
            {/* Most Influential Relationships */}
            {result.relationshipMetrics?.mostInfluentialRelationships && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Most Influential Relationships
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Source Property</TableCell>
                          <TableCell>Relationship Type</TableCell>
                          <TableCell>Importance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.relationshipMetrics.mostInfluentialRelationships.map((relationship, index) => (
                          <TableRow key={index}>
                            <TableCell>{formatPropertyName(relationship.sourceProperty)}</TableCell>
                            <TableCell>
                              <Chip
                                label={formatRelationshipType(relationship.relationshipType)}
                                color={
                                  relationship.relationshipType === RelationshipType.CORRELATION
                                    ? 'primary'
                                    : relationship.relationshipType === RelationshipType.DEPENDENCY
                                    ? 'secondary'
                                    : relationship.relationshipType === RelationshipType.COMPATIBILITY
                                    ? 'success'
                                    : relationship.relationshipType === RelationshipType.EXCLUSION
                                    ? 'error'
                                    : 'default'
                                }
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{(relationship.importance * 100).toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            )}
            
            {/* Feature Importance */}
            {result.featureImportance && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Feature Importance
                  </Typography>
                  <Box height={400}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={prepareFeatureImportanceData()}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 150, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={150}
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip
                          formatter={(value: number) => [(value * 100).toFixed(2) + '%', 'Importance']}
                        />
                        <Legend />
                        <Bar
                          dataKey="value"
                          fill="#8884d8"
                          name="Feature Importance"
                          barSize={20}
                        >
                          {prepareFeatureImportanceData().map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.isRelationship ? '#82ca9d' : '#8884d8'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Chip
                      label="Base Features"
                      size="small"
                      sx={{ bgcolor: '#8884d8', color: 'white' }}
                    />
                    <Chip
                      label="Relationship Features"
                      size="small"
                      sx={{ bgcolor: '#82ca9d', color: 'white' }}
                    />
                  </Box>
                </Paper>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RelationshipAwareModelResults;
