import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Tabs, 
  Tab, 
  Paper,
  Container
} from '@mui/material';
import { 
  Psychology as PsychologyIcon,
  BarChart as BarChartIcon,
  AutoFixHigh as AutoFixHighIcon,
  Link as LinkIcon,
  BubbleChart as BubbleChartIcon
} from '@mui/icons-material';

// Import advanced feature components
import MLModelList from './ml/MLModelList';
import PromptPrediction from './ml/PromptPrediction';
import StatisticalAnalysis from './statistical/StatisticalAnalysis';
import OptimizationRuleList from './optimization/OptimizationRuleList';
import IntegrationList from './integration/IntegrationList';
import SegmentDiscovery from './segmentation/SegmentDiscovery';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`advanced-features-tabpanel-${index}`}
      aria-labelledby={`advanced-features-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `advanced-features-tab-${index}`,
    'aria-controls': `advanced-features-tabpanel-${index}`,
  };
}

const PromptAdvancedFeatures: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Advanced Prompt Features
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage machine learning models, statistical analysis, automated optimization, external integrations, and segment discovery.
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="advanced features tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<PsychologyIcon />} label="ML Models" {...a11yProps(0)} />
            <Tab icon={<PsychologyIcon />} label="Predictions" {...a11yProps(1)} />
            <Tab icon={<BarChartIcon />} label="Statistical Analysis" {...a11yProps(2)} />
            <Tab icon={<AutoFixHighIcon />} label="Optimization" {...a11yProps(3)} />
            <Tab icon={<LinkIcon />} label="Integrations" {...a11yProps(4)} />
            <Tab icon={<BubbleChartIcon />} label="Segment Discovery" {...a11yProps(5)} />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <MLModelList />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <PromptPrediction />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <StatisticalAnalysis />
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <OptimizationRuleList />
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <IntegrationList />
        </TabPanel>

        <TabPanel value={tabValue} index={5}>
          <SegmentDiscovery />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default PromptAdvancedFeatures;
