import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { toast } from 'react-toastify';
import { api } from '../../services/api';

interface TopupSetting {
  id: string;
  userId: string;
  isEnabled: boolean;
  thresholdAmount: number;
  topupAmount: number;
  maxMonthlySpend?: number;
  paymentMethodId?: string;
  lastTopupAt?: string;
  monthlySpend?: number;
  monthlySpendResetAt?: string;
}

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface CreditTopupSettingsProps {
  onSaved?: () => void;
}

const CreditTopupSettings: React.FC<CreditTopupSettingsProps> = ({ onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TopupSetting | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState(100);
  const [topupAmount, setTopupAmount] = useState(500);
  const [hasMonthlyLimit, setHasMonthlyLimit] = useState(false);
  const [maxMonthlySpend, setMaxMonthlySpend] = useState(100);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [error, setError] = useState('');

  // Fetch settings and payment methods
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch topup settings
        const settingsResponse = await api.get('/credits/topup/settings');
        const settingsData = settingsResponse.data.data;
        
        setSettings(settingsData.setting);
        setCreditBalance(settingsData.creditBalance);
        
        if (settingsData.setting) {
          setIsEnabled(settingsData.setting.isEnabled);
          setThresholdAmount(settingsData.setting.thresholdAmount);
          setTopupAmount(settingsData.setting.topupAmount);
          setHasMonthlyLimit(!!settingsData.setting.maxMonthlySpend);
          setMaxMonthlySpend(settingsData.setting.maxMonthlySpend || 100);
          setSelectedPaymentMethod(settingsData.setting.paymentMethodId || '');
        }
        
        // Fetch payment methods
        const paymentResponse = await api.get('/payment/methods');
        setPaymentMethods(paymentResponse.data.data);
        
        // Set default payment method if none selected
        if (!selectedPaymentMethod && paymentResponse.data.data.length > 0) {
          const defaultMethod = paymentResponse.data.data.find((method: PaymentMethod) => method.isDefault);
          setSelectedPaymentMethod(defaultMethod ? defaultMethod.id : paymentResponse.data.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch settings');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Save settings
  const handleSave = async () => {
    if (isEnabled && !selectedPaymentMethod) {
      setError('Please select a payment method');
      return;
    }
    
    setSaving(true);
    setError('');
    
    try {
      await api.post('/credits/topup/settings', {
        isEnabled,
        thresholdAmount,
        topupAmount,
        maxMonthlySpend: hasMonthlyLimit ? maxMonthlySpend : undefined,
        paymentMethodId: selectedPaymentMethod
      });
      
      toast.success('Auto top-up settings saved successfully');
      
      if (onSaved) {
        onSaved();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('Failed to save settings');
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Format payment method
  const formatPaymentMethod = (method: PaymentMethod) => {
    return `${method.brand} •••• ${method.last4} (expires ${method.expiryMonth}/${method.expiryYear})`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardHeader title="Automatic Credit Top-up" />
      <CardContent>
        <Typography variant="body1" paragraph>
          Set up automatic credit top-ups to ensure you never run out of credits. We'll automatically purchase more credits when your balance falls below the threshold.
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Current Credit Balance
          </Typography>
          <Typography variant="h5" color="primary">
            {creditBalance} credits
          </Typography>
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <FormControlLabel
          control={
            <Switch
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              color="primary"
            />
          }
          label="Enable automatic top-up"
          sx={{ mb: 3 }}
        />
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Threshold Amount"
              type="number"
              value={thresholdAmount}
              onChange={(e) => setThresholdAmount(parseInt(e.target.value))}
              disabled={!isEnabled}
              InputProps={{
                endAdornment: <InputAdornment position="end">credits</InputAdornment>,
              }}
              helperText="Top-up when balance falls below this amount"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Top-up Amount"
              type="number"
              value={topupAmount}
              onChange={(e) => setTopupAmount(parseInt(e.target.value))}
              disabled={!isEnabled}
              InputProps={{
                endAdornment: <InputAdornment position="end">credits</InputAdornment>,
              }}
              helperText="Amount of credits to purchase"
            />
          </Grid>
          
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={hasMonthlyLimit}
                  onChange={(e) => setHasMonthlyLimit(e.target.checked)}
                  disabled={!isEnabled}
                />
              }
              label="Set monthly spending limit"
            />
          </Grid>
          
          {hasMonthlyLimit && (
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monthly Spending Limit"
                type="number"
                value={maxMonthlySpend}
                onChange={(e) => setMaxMonthlySpend(parseInt(e.target.value))}
                disabled={!isEnabled}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                helperText="Maximum amount to spend per month"
              />
            </Grid>
          )}
          
          <Grid item xs={12}>
            <FormControl fullWidth disabled={!isEnabled}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                label="Payment Method"
              >
                {paymentMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    {formatPaymentMethod(method)}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Payment method to use for automatic top-ups
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        
        {settings && settings.lastTopupAt && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Last automatic top-up: {new Date(settings.lastTopupAt).toLocaleString()}
            </Typography>
            {settings.monthlySpend !== undefined && (
              <Typography variant="body2" color="text.secondary">
                Monthly spend so far: ${settings.monthlySpend.toFixed(2)}
                {settings.monthlySpendResetAt && (
                  <span> (resets on {new Date(settings.monthlySpendResetAt).toLocaleDateString()})</span>
                )}
              </Typography>
            )}
          </Box>
        )}
        
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 2 }}>
            {error}
          </Typography>
        )}
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <CircularProgress size={24} /> : 'Save Settings'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CreditTopupSettings;
