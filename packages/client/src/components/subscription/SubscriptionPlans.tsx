import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Grid, 
  Chip, 
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  useTheme
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useUser } from '../../providers/UserProvider';
import { fetchSubscriptionTiers, getCurrentSubscription } from '../../services/subscriptionService';
import { SubscriptionTier, UserSubscription } from '../../types/subscription';

interface SubscriptionPlansProps {
  onSelectPlan: (tier: SubscriptionTier) => void;
}

const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ onSelectPlan }) => {
  const theme = useTheme();
  const { user } = useUser();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch subscription tiers
        const tiersResponse = await fetchSubscriptionTiers();
        setTiers(tiersResponse.data);
        
        // Fetch current subscription if user is logged in
        if (user) {
          const subscriptionResponse = await getCurrentSubscription();
          setCurrentSubscription(subscriptionResponse.data);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading subscription data:', err);
        setError('Failed to load subscription plans. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  const isCurrentPlan = (tierId: string): boolean => {
    return !!currentSubscription && currentSubscription.tierId === tierId;
  };

  const formatPrice = (price: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(price);
  };

  const renderFeatureItem = (feature: string, included: boolean) => (
    <ListItem key={feature}>
      <ListItemIcon>
        {included ? (
          <CheckIcon color="success" />
        ) : (
          <CloseIcon color="error" />
        )}
      </ListItemIcon>
      <ListItemText primary={feature} />
    </ListItem>
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Subscription Plans
      </Typography>
      <Typography variant="subtitle1" gutterBottom align="center" color="textSecondary" mb={4}>
        Choose the plan that best fits your needs
      </Typography>
      
      <Grid container spacing={4} justifyContent="center">
        {tiers.map((tier) => (
          <Grid item xs={12} sm={6} md={4} key={tier.id}>
            <Card 
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 2,
                boxShadow: 3,
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: 6
                },
                ...(tier.name === 'Premium' && {
                  border: `2px solid ${theme.palette.primary.main}`,
                })
              }}
            >
              {tier.name === 'Premium' && (
                <Box bgcolor="primary.main" py={0.5}>
                  <Typography variant="subtitle2" align="center" color="white">
                    MOST POPULAR
                  </Typography>
                </Box>
              )}
              
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h5" component="h2" gutterBottom align="center">
                  {tier.name}
                </Typography>
                
                <Typography variant="h4" component="div" align="center" gutterBottom>
                  {formatPrice(tier.price, tier.currency)}
                  <Typography variant="caption" color="textSecondary">
                    /{tier.billingInterval}
                  </Typography>
                </Typography>
                
                <Typography variant="body2" color="textSecondary" align="center" paragraph>
                  {tier.description}
                </Typography>
                
                <Divider sx={{ my: 2 }} />
                
                <List dense>
                  {/* API Limits */}
                  {renderFeatureItem(
                    `${tier.apiLimits.requestsPerDay} API requests per day`,
                    true
                  )}
                  
                  {/* Storage Limits */}
                  {renderFeatureItem(
                    `${tier.storageLimits.maxStorageGB}GB storage`,
                    true
                  )}
                  
                  {/* Credits */}
                  {renderFeatureItem(
                    `${tier.creditLimits.includedCredits} credits included`,
                    tier.creditLimits.includedCredits > 0
                  )}
                  
                  {/* Moodboards */}
                  {renderFeatureItem(
                    `${tier.maxMoodboards || 'Unlimited'} moodboards`,
                    !!tier.maxMoodboards || tier.name !== 'Free'
                  )}
                  
                  {/* Module Access */}
                  {tier.moduleAccess.map(module => 
                    renderFeatureItem(
                      module.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                      module.enabled
                    )
                  )}
                  
                  {/* Support Level */}
                  {renderFeatureItem(
                    `${tier.supportLevel.charAt(0).toUpperCase() + tier.supportLevel.slice(1)} Support`,
                    true
                  )}
                </List>
              </CardContent>
              
              <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                {isCurrentPlan(tier.id) ? (
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    disabled
                    fullWidth
                    sx={{ mx: 2 }}
                  >
                    Current Plan
                  </Button>
                ) : (
                  <Button 
                    variant="contained" 
                    color="primary"
                    fullWidth
                    sx={{ mx: 2 }}
                    onClick={() => onSelectPlan(tier)}
                  >
                    {tier.price === 0 ? 'Select Free Plan' : 'Select Plan'}
                  </Button>
                )}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SubscriptionPlans;
