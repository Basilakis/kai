import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Divider
} from '@mui/material';
import {
  Home as HomeIcon,
  Category as CategoryIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import AdminLayout from '../../components/layouts/AdminLayout';
import MaterialMetadataPanel from '../../components/MaterialMetadataPanel';
import MaterialClassificationTab from '../../components/material/MaterialClassificationTab';

enum TabValue {
  DETAILS = 'details',
  METADATA = 'metadata',
  CLASSIFICATIONS = 'classifications',
  IMAGES = 'images',
  HISTORY = 'history'
}

/**
 * Material Detail Page
 * 
 * Page for viewing and editing a specific material.
 */
const MaterialDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState<TabValue>(TabValue.DETAILS);
  const [material, setMaterial] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMaterial = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);

        // In a real app, this would be an API call
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock material data
        setMaterial({
          id,
          name: `Material ${id}`,
          type: 'tile',
          manufacturer: 'Example Manufacturer',
          description: 'This is an example material description.',
          metadata: {
            color: 'White',
            finish: 'Matte',
            size: '60x60 cm',
            thickness: '10mm',
            material: 'Ceramic'
          },
          images: [
            { url: 'https://via.placeholder.com/500', alt: 'Material Image' }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMaterial();
  }, [id]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  const handleMetadataChange = (newMetadata: any) => {
    setMaterial(prev => ({
      ...prev,
      metadata: newMetadata
    }));
  };

  return (
    <AdminLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: 3 }}>
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              color="inherit"
              href="/dashboard"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Dashboard
            </Link>
            <Link
              color="inherit"
              href="/materials"
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <CategoryIcon sx={{ mr: 0.5 }} fontSize="inherit" />
              Materials
            </Link>
            <Typography
              sx={{ display: 'flex', alignItems: 'center' }}
              color="text.primary"
            >
              {loading ? 'Loading...' : material?.name || 'Material Details'}
            </Typography>
          </Breadcrumbs>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Link
              href="/materials"
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                mr: 2,
                color: 'text.primary',
                textDecoration: 'none'
              }}
            >
              <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
              Back to Materials
            </Link>
            <Typography variant="h4" component="h1">
              {loading ? 'Loading Material...' : material?.name || 'Material Details'}
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
              <CircularProgress />
            </Box>
          ) : material ? (
            <>
              <Paper sx={{ mb: 3 }}>
                <Tabs
                  value={activeTab}
                  onChange={handleTabChange}
                  indicatorColor="primary"
                  textColor="primary"
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab label="Details" value={TabValue.DETAILS} />
                  <Tab label="Metadata" value={TabValue.METADATA} />
                  <Tab label="Classifications" value={TabValue.CLASSIFICATIONS} />
                  <Tab label="Images" value={TabValue.IMAGES} />
                  <Tab label="History" value={TabValue.HISTORY} />
                </Tabs>
              </Paper>
              
              {activeTab === TabValue.DETAILS && (
                <Paper sx={{ p: 3 }}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        Basic Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            ID:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">{material.id}</Typography>
                        </Grid>
                        
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Name:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">{material.name}</Typography>
                        </Grid>
                        
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Type:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Chip label={material.type} size="small" />
                        </Grid>
                        
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Manufacturer:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">{material.manufacturer}</Typography>
                        </Grid>
                        
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Created:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">
                            {new Date(material.createdAt).toLocaleString()}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={4}>
                          <Typography variant="body2" color="text.secondary">
                            Updated:
                          </Typography>
                        </Grid>
                        <Grid item xs={8}>
                          <Typography variant="body2">
                            {new Date(material.updatedAt).toLocaleString()}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="h6" gutterBottom>
                        Description
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      <Typography variant="body2" paragraph>
                        {material.description}
                      </Typography>
                      
                      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                        Preview
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      {material.images && material.images.length > 0 ? (
                        <Box
                          component="img"
                          src={material.images[0].url}
                          alt={material.images[0].alt || material.name}
                          sx={{
                            width: '100%',
                            maxHeight: 300,
                            objectFit: 'contain',
                            borderRadius: 1
                          }}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No images available
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                </Paper>
              )}
              
              {activeTab === TabValue.METADATA && (
                <Paper>
                  <MaterialMetadataPanel
                    materialType={material.type}
                    metadata={material.metadata}
                    onMetadataChange={handleMetadataChange}
                  />
                </Paper>
              )}
              
              {activeTab === TabValue.CLASSIFICATIONS && (
                <Paper>
                  <MaterialClassificationTab
                    materialId={material.id}
                    materialName={material.name}
                  />
                </Paper>
              )}
              
              {activeTab === TabValue.IMAGES && (
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Images
                  </Typography>
                  <Typography variant="body1">
                    Image management will be implemented in a future update.
                  </Typography>
                </Paper>
              )}
              
              {activeTab === TabValue.HISTORY && (
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    History
                  </Typography>
                  <Typography variant="body1">
                    Version history will be implemented in a future update.
                  </Typography>
                </Paper>
              )}
            </>
          ) : (
            <Alert severity="info">
              Material not found
            </Alert>
          )}
        </Box>
      </Container>
    </AdminLayout>
  );
};

export default MaterialDetailPage;
