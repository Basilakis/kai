// packages/admin/src/pages/huggingface-training/index.tsx

import React from 'react';
import { Box, Typography, Grid, Paper, Link as MuiLink, Theme } from '@mui/material';
import { Link } from 'react-router-dom';
import { styled } from '@mui/system';

const FeaturePaper = styled(Paper)(({ theme }: { theme: Theme }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  color: theme.palette.text.secondary,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const HuggingFaceTrainingPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Hugging Face Model Training
      </Typography>
      <Typography variant="subtitle1" gutterBottom sx={{ mb: 4 }}>
        Manage datasets, trainable models, and training jobs for Hugging Face integrations.
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <MuiLink component={Link} to="/huggingface-training/datasets" underline="none">
            <FeaturePaper elevation={3}>
              <Typography variant="h6" component="h2" gutterBottom>
                Manage Datasets
              </Typography>
              <Typography variant="body2">
                Register and manage Hugging Face datasets available for training.
              </Typography>
            </FeaturePaper>
          </MuiLink>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiLink component={Link} to="/huggingface-training/models" underline="none">
            <FeaturePaper elevation={3}>
              <Typography variant="h6" component="h2" gutterBottom>
                Trainable Models
              </Typography>
              <Typography variant="body2">
                Configure models that can be fine-tuned with your datasets.
              </Typography>
            </FeaturePaper>
          </MuiLink>
        </Grid>
        <Grid item xs={12} md={4}>
          <MuiLink component={Link} to="/huggingface-training/jobs" underline="none">
            <FeaturePaper elevation={3}>
              <Typography variant="h6" component="h2" gutterBottom>
                Training Jobs
              </Typography>
              <Typography variant="body2">
                Launch, monitor, and review your model training jobs.
              </Typography>
            </FeaturePaper>
          </MuiLink>
        </Grid>
      </Grid>
    </Box>
  );
};

export default HuggingFaceTrainingPage;