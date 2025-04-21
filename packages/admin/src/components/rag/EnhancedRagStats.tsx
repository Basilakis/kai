import React, { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Grid, Button, CircularProgress, Box } from '@mui/material';
import { apiClient } from '../../utils/apiClient';

interface SystemStats {
  components: {
    model_registry: boolean;
    learning_pipeline: boolean;
    distributed_retrieval: boolean;
    hierarchical_retriever: boolean;
    cross_modal_attention: boolean;
  };
  distributed_retrieval?: {
    stores: any[];
    cache_enabled: boolean;
    cache_ttl_seconds: number;
    max_concurrent_requests: number;
    cache?: {
      hits: number;
      misses: number;
      sets: number;
      invalidations: number;
      size: number;
      hit_rate: number;
    };
  };
  models?: {
    embedding: any;
    generative: any;
  };
}

const EnhancedRagStats: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/rag/stats');
      setStats(response.data);
    } catch (err) {
      setError('Failed to fetch RAG system stats');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const triggerFineTuning = async () => {
    try {
      await apiClient.post('/api/rag/admin/fine-tune');
      alert('Fine-tuning triggered successfully');
    } catch (err) {
      alert('Failed to trigger fine-tuning');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{error}</Typography>
          <Button variant="contained" onClick={fetchStats} sx={{ mt: 2 }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Typography variant="h5" gutterBottom>
        Enhanced RAG System Stats
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Components Status
              </Typography>
              {stats?.components && (
                <Grid container spacing={2}>
                  {Object.entries(stats.components).map(([key, value]) => (
                    <Grid item xs={6} key={key}>
                      <Typography variant="body2">
                        {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}:
                        <Box component="span" sx={{ 
                          color: value ? 'success.main' : 'error.main',
                          fontWeight: 'bold',
                          ml: 1
                        }}>
                          {value ? 'Active' : 'Inactive'}
                        </Box>
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cache Performance
              </Typography>
              {stats?.distributed_retrieval?.cache ? (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Hit Rate: {(stats.distributed_retrieval.cache.hit_rate * 100).toFixed(2)}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Cache Size: {stats.distributed_retrieval.cache.size} items
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Hits: {stats.distributed_retrieval.cache.hits}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      Misses: {stats.distributed_retrieval.cache.misses}
                    </Typography>
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2">Cache information not available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Models
              </Typography>
              {stats?.models ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1">Embedding Model</Typography>
                    <Typography variant="body2">
                      {stats.models.embedding ? (
                        <>ID: {stats.models.embedding.id}</>
                      ) : (
                        'No default embedding model'
                      )}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1">Generative Model</Typography>
                    <Typography variant="body2">
                      {stats.models.generative ? (
                        <>ID: {stats.models.generative.id}</>
                      ) : (
                        'No default generative model'
                      )}
                    </Typography>
                  </Grid>
                </Grid>
              ) : (
                <Typography variant="body2">Model information not available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Box display="flex" justifyContent="flex-end" mt={2}>
            <Button variant="contained" color="primary" onClick={fetchStats} sx={{ mr: 2 }}>
              Refresh Stats
            </Button>
            <Button variant="contained" color="secondary" onClick={triggerFineTuning}>
              Trigger Fine-Tuning
            </Button>
          </Box>
        </Grid>
      </Grid>
    </div>
  );
};

export default EnhancedRagStats;
