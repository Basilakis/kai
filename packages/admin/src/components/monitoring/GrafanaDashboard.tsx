import React, { useState } from 'react';
import { Box, Typography, Paper, Select, MenuItem, FormControl, InputLabel, Button, Link } from '@mui/material';
import { OpenInNewIcon, RefreshIcon } from '../mui-icons';

interface GrafanaDashboardProps {
  title: string;
  description?: string;
  url: string;
  height?: number;
  refreshInterval?: number;
}

/**
 * GrafanaDashboard Component
 * 
 * Embeds a Grafana dashboard in an iframe with refresh controls.
 */
const GrafanaDashboard: React.FC<GrafanaDashboardProps> = ({
  title,
  description,
  url,
  height = 600,
  refreshInterval = 0
}) => {
  const [refresh, setRefresh] = useState<number>(refreshInterval);
  const [key, setKey] = useState<number>(0); // Used to force iframe refresh
  
  // Handle refresh interval change
  const handleRefreshChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const value = event.target.value as number;
    setRefresh(value);
  };
  
  // Handle manual refresh
  const handleManualRefresh = () => {
    setKey(prevKey => prevKey + 1);
  };
  
  // Set up automatic refresh
  React.useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    if (refresh > 0) {
      intervalId = setInterval(() => {
        setKey(prevKey => prevKey + 1);
      }, refresh * 1000);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [refresh]);
  
  return (
    <Paper elevation={2} sx={{ mb: 4 }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120, mr: 2 }}>
              <InputLabel id="refresh-interval-label">Refresh</InputLabel>
              <Select
                labelId="refresh-interval-label"
                value={refresh}
                label="Refresh"
                onChange={handleRefreshChange}
              >
                <MenuItem value={0}>Off</MenuItem>
                <MenuItem value={10}>10s</MenuItem>
                <MenuItem value={30}>30s</MenuItem>
                <MenuItem value={60}>1m</MenuItem>
                <MenuItem value={300}>5m</MenuItem>
                <MenuItem value={900}>15m</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleManualRefresh}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              sx={{ ml: 1 }}
              component={Link}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
            </Button>
          </Box>
        </Box>
        {description && (
          <Typography variant="body2" color="textSecondary">
            {description}
          </Typography>
        )}
      </Box>
      <Box sx={{ width: '100%', height }}>
        <iframe
          key={key}
          src={url}
          width="100%"
          height="100%"
          frameBorder="0"
          title={title}
          style={{ border: 'none' }}
        />
      </Box>
    </Paper>
  );
};

export default GrafanaDashboard;
