import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import {
  CardElement,
  useStripe,
  useElements,
  Elements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { SubscriptionTier } from '../../types/subscription';
import { subscribeToTier } from '../../services/subscriptionService';

// Load Stripe outside of component to avoid recreating it on renders
const stripePromise = loadStripe(process.env.GATSBY_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentFormProps {
  selectedTier: SubscriptionTier;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentFormContent: React.FC<PaymentFormProps> = ({ 
  selectedTier, 
  onSuccess, 
  onCancel 
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    phone: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });
  const [trialEnabled, setTrialEnabled] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet
      return;
    }

    if (!cardComplete) {
      setError('Please complete your card details');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create payment method
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingDetails,
      });

      if (paymentMethodError) {
        setError(paymentMethodError.message || 'An error occurred with your payment');
        setProcessing(false);
        return;
      }

      // Subscribe to tier
      const response = await subscribeToTier(
        selectedTier.id,
        paymentMethod.id,
        trialEnabled ? 14 : 0, // 14-day trial if enabled
        { billingDetails }
      );

      // Handle subscription that requires additional action
      if (response.requiresAction && response.clientSecret) {
        const { error: confirmError } = await stripe.confirmCardPayment(response.clientSecret);
        if (confirmError) {
          setError(confirmError.message || 'An error occurred with your payment');
          setProcessing(false);
          return;
        }
      }

      // Success
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Subscription Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body1">Plan:</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1" align="right">{selectedTier.name}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1">Price:</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body1" align="right">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: selectedTier.currency.toUpperCase(),
                }).format(selectedTier.price)}
                /{selectedTier.billingInterval}
              </Typography>
            </Grid>
            {selectedTier.creditLimits.includedCredits > 0 && (
              <>
                <Grid item xs={6}>
                  <Typography variant="body1">Included Credits:</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body1" align="right">
                    {selectedTier.creditLimits.includedCredits}
                  </Typography>
                </Grid>
              </>
            )}
          </Grid>

          {selectedTier.price > 0 && (
            <FormControlLabel
              control={
                <Switch
                  checked={trialEnabled}
                  onChange={(e) => setTrialEnabled(e.target.checked)}
                  color="primary"
                />
              }
              label="Start with a 14-day free trial"
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>

      {selectedTier.price > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Payment Information
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Name on Card"
                  fullWidth
                  required
                  value={billingDetails.name}
                  onChange={(e) => setBillingDetails({ ...billingDetails, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  fullWidth
                  required
                  type="email"
                  value={billingDetails.email}
                  onChange={(e) => setBillingDetails({ ...billingDetails, email: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" gutterBottom>
                  Card Details
                </Typography>
                <Box
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    p: 2,
                    '&:focus-within': {
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CardElement
                    options={cardElementOptions}
                    onChange={(e) => setCardComplete(e.complete)}
                  />
                </Box>
              </Grid>
            </Grid>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="outlined"
          color="secondary"
          onClick={onCancel}
          sx={{ mr: 2 }}
          disabled={processing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={processing || (selectedTier.price > 0 && (!stripe || !elements || !cardComplete))}
        >
          {processing ? (
            <CircularProgress size={24} />
          ) : (
            selectedTier.price === 0 ? 'Subscribe to Free Plan' : 'Subscribe Now'
          )}
        </Button>
      </Box>
    </form>
  );
};

// Wrapper component that provides Stripe context
const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormContent {...props} />
    </Elements>
  );
};

export default PaymentForm;
