import React, { useState } from 'react';
import { Container, Typography, Box, Tabs, Tab, Paper } from '@mui/material';
import EnhancedRagStats from '../components/rag/EnhancedRagStats';
import ModelRegistry from '../components/rag/ModelRegistry';

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
      id={`rag-tabpanel-${index}`}
      aria-labelledby={`rag-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `rag-tab-${index}`,
    'aria-controls': `rag-tabpanel-${index}`,
  };
}

const EnhancedRagPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" component="h1" gutterBottom>
        Enhanced RAG System
      </Typography>
      
      <Paper sx={{ width: '100%', mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="RAG system tabs">
            <Tab label="System Stats" {...a11yProps(0)} />
            <Tab label="Model Registry" {...a11yProps(1)} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <EnhancedRagStats />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <ModelRegistry />
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default EnhancedRagPage;
