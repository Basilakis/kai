import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Typography,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getPaymentMethods, addPaymentMethod } from '../../services/subscriptionService';
import { PaymentMethod } from '../../types/subscription';

// Load Stripe outside of component to avoid recreating it on renders
const stripePromise = loadStripe(process.env.GATSBY_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentMethodSelectorProps {
  onSelectPaymentMethod: (paymentMethodId: string) => void;
  selectedPaymentMethod: string;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  onSelectPaymentMethod,
  selectedPaymentMethod
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [addCardDialogOpen, setAddCardDialogOpen] = useState<boolean>(false);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getPaymentMethods();
      setPaymentMethods(response.data);
      
      // If we have payment methods and none is selected, select the first one
      if (response.data.length > 0 && !selectedPaymentMethod) {
        onSelectPaymentMethod(response.data[0].id);
      }
    } catch (err: any) {
      console.error('Error loading payment methods:', err);
      setError(err.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const handleAddCardDialogOpen = () => {
    setAddCardDialogOpen(true);
  };

  const handleAddCardDialogClose = () => {
    setAddCardDialogOpen(false);
  };

  const handlePaymentMethodAdded = () => {
    handleAddCardDialogClose();
    loadPaymentMethods();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={2}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {paymentMethods.length === 0 ? (
        <Box textAlign="center" my={2}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            No payment methods found
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<AddIcon />}
            onClick={handleAddCardDialogOpen}
          >
            Add Payment Method
          </Button>
        </Box>
      ) : (
        <>
          <RadioGroup
            value={selectedPaymentMethod}
            onChange={(e) => onSelectPaymentMethod(e.target.value)}
          >
            <Grid container spacing={2}>
              {paymentMethods.map((method) => (
                <Grid item xs={12} key={method.id}>
                  <Card 
                    variant="outlined"
                    sx={{
                      border: method.id === selectedPaymentMethod ? 
                        '2px solid' : '1px solid',
                      borderColor: method.id === selectedPaymentMethod ? 
                        'primary.main' : 'divider'
                    }}
                  >
                    <CardContent sx={{ py: 1 }}>
                      <FormControlLabel
                        value={method.id}
                        control={<Radio />}
                        label={
                          <Box display="flex" alignItems="center">
                            <CreditCardIcon sx={{ mr: 1 }} />
                            <Box>
                              <Typography variant="body1">
                                {method.card?.brand.charAt(0).toUpperCase() + method.card?.brand.slice(1)} •••• {method.card?.last4}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                Expires {method.card?.expMonth}/{method.card?.expYear}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </RadioGroup>
          
          <Box mt={2}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddCardDialogOpen}
              size="small"
            >
              Add Payment Method
            </Button>
          </Box>
        </>
      )}
      
      <AddCardDialog
        open={addCardDialogOpen}
        onClose={handleAddCardDialogClose}
        onSuccess={handlePaymentMethodAdded}
      />
    </Box>
  );
};

interface AddCardDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddCardForm: React.FC<AddCardDialogProps> = ({ onClose, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState<boolean>(false);
  const [processing, setProcessing] = useState<boolean>(false);

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
      });

      if (paymentMethodError) {
        setError(paymentMethodError.message || 'An error occurred with your payment method');
        setProcessing(false);
        return;
      }

      // Add payment method to user
      await addPaymentMethod(paymentMethod.id);

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
      <DialogContent>
        <Typography variant="body2" gutterBottom>
          Add a new credit or debit card
        </Typography>
        <Box
          sx={{
            border: '1px solid #e0e0e0',
            borderRadius: 1,
            p: 2,
            mt: 2,
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
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={processing || !stripe || !elements || !cardComplete}
        >
          {processing ? <CircularProgress size={24} /> : 'Add Card'}
        </Button>
      </DialogActions>
    </form>
  );
};

const AddCardDialog: React.FC<AddCardDialogProps> = (props) => {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Payment Method</DialogTitle>
      <Elements stripe={stripePromise}>
        <AddCardForm {...props} />
      </Elements>
    </Dialog>
  );
};

export default PaymentMethodSelector;
