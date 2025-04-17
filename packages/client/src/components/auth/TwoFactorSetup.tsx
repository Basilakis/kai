import React, { useState, useEffect } from 'react';
import { Box, Button, Card, CardContent, CardHeader, CircularProgress, FormControl, FormHelperText, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import QRCode from 'qrcode.react';
import { toast } from 'react-toastify';
import { api } from '../../services/api';

type TwoFactorMethod = 'totp' | 'sms' | 'email';

interface TwoFactorSetupProps {
  onComplete?: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<TwoFactorMethod>('totp');
  const [step, setStep] = useState(1);
  const [totpSecret, setTotpSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Fetch available methods
  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const response = await api.get('/auth/2fa/methods');
        if (response.data.data.methods.length > 0) {
          setMethod(response.data.data.methods[0]);
        }
      } catch (error) {
        console.error('Error fetching 2FA methods:', error);
        toast.error('Failed to fetch available 2FA methods');
      }
    };

    fetchMethods();
  }, []);

  // Setup TOTP
  const setupTOTP = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/2fa/setup/totp');
      setTotpSecret(response.data.data.secret);
      setQrCodeUrl(response.data.data.qrCodeUrl);
      setStep(2);
    } catch (error) {
      console.error('Error setting up TOTP:', error);
      setError('Failed to set up TOTP authentication');
      toast.error('Failed to set up TOTP authentication');
    } finally {
      setLoading(false);
    }
  };

  // Setup SMS
  const setupSMS = async () => {
    if (!phoneNumber) {
      setError('Phone number is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/2fa/setup/sms', { phoneNumber });
      setStep(2);
      toast.success('Verification code sent to your phone');
    } catch (error) {
      console.error('Error setting up SMS:', error);
      setError('Failed to set up SMS authentication');
      toast.error('Failed to set up SMS authentication');
    } finally {
      setLoading(false);
    }
  };

  // Setup Email
  const setupEmail = async () => {
    if (!email) {
      setError('Email is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/2fa/setup/email', { email });
      setStep(2);
      toast.success('Verification code sent to your email');
    } catch (error) {
      console.error('Error setting up Email:', error);
      setError('Failed to set up Email authentication');
      toast.error('Failed to set up Email authentication');
    } finally {
      setLoading(false);
    }
  };

  // Verify and enable 2FA
  const verifyAndEnable = async () => {
    if (!verificationCode) {
      setError('Verification code is required');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // First verify the code
      await api.post('/auth/2fa/verify', { 
        method, 
        code: verificationCode,
        phoneNumber: method === 'sms' ? phoneNumber : undefined,
        email: method === 'email' ? email : undefined
      });
      
      // Then enable 2FA
      const response = await api.post('/auth/2fa/enable', { method });
      
      // Get backup codes
      const backupResponse = await api.get('/auth/2fa/backup-codes');
      setBackupCodes(backupResponse.data.data.codes);
      
      setStep(3);
      toast.success('Two-factor authentication enabled successfully');
    } catch (error) {
      console.error('Error verifying code:', error);
      setError('Invalid verification code');
      toast.error('Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  // Handle setup based on method
  const handleSetup = () => {
    switch (method) {
      case 'totp':
        setupTOTP();
        break;
      case 'sms':
        setupSMS();
        break;
      case 'email':
        setupEmail();
        break;
    }
  };

  // Handle method change
  const handleMethodChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    setMethod(event.target.value as TwoFactorMethod);
    setStep(1);
    setError('');
  };

  // Handle completion
  const handleComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  return (
    <Card>
      <CardHeader title="Set Up Two-Factor Authentication" />
      <CardContent>
        {step === 1 && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Two-factor authentication adds an extra layer of security to your account.
            </Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Authentication Method</InputLabel>
              <Select
                value={method}
                onChange={handleMethodChange}
                label="Authentication Method"
              >
                <MenuItem value="totp">Authenticator App (TOTP)</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="email">Email</MenuItem>
              </Select>
              <FormHelperText>
                {method === 'totp' && 'Use an authenticator app like Google Authenticator or Authy'}
                {method === 'sms' && 'Receive verification codes via SMS'}
                {method === 'email' && 'Receive verification codes via email'}
              </FormHelperText>
            </FormControl>
            
            {method === 'sms' && (
              <TextField
                fullWidth
                margin="normal"
                label="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                helperText="Enter your phone number with country code"
              />
            )}
            
            {method === 'email' && (
              <TextField
                fullWidth
                margin="normal"
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Enter your email address"
              />
            )}
            
            {error && (
              <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleSetup}
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Continue'}
            </Button>
          </Box>
        )}
        
        {step === 2 && (
          <Box>
            {method === 'totp' && (
              <>
                <Typography variant="body1" gutterBottom>
                  Scan this QR code with your authenticator app:
                </Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
                  {qrCodeUrl && <QRCode value={qrCodeUrl} size={200} />}
                </Box>
                
                <Typography variant="body2" gutterBottom>
                  Or enter this code manually: <code>{totpSecret}</code>
                </Typography>
              </>
            )}
            
            <Typography variant="body1" sx={{ mt: 3 }}>
              Enter the verification code:
            </Typography>
            
            <TextField
              fullWidth
              margin="normal"
              label="Verification Code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="123456"
            />
            
            {error && (
              <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                {error}
              </Typography>
            )}
            
            <Button
              variant="contained"
              color="primary"
              onClick={verifyAndEnable}
              disabled={loading}
              sx={{ mt: 3 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Verify & Enable'}
            </Button>
          </Box>
        )}
        
        {step === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom color="success.main">
              Two-factor authentication enabled successfully!
            </Typography>
            
            <Typography variant="body1" sx={{ mt: 3, mb: 2 }}>
              Backup Codes (save these somewhere safe):
            </Typography>
            
            <Box sx={{ 
              backgroundColor: 'grey.100', 
              p: 2, 
              borderRadius: 1,
              mb: 3
            }}>
              <Grid container spacing={1}>
                {backupCodes.map((code, index) => (
                  <Grid item xs={6} key={index}>
                    <Typography variant="mono" fontFamily="monospace">
                      {code}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              These backup codes can be used to access your account if you lose access to your authentication device. Each code can only be used once.
            </Typography>
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleComplete}
              sx={{ mt: 2 }}
            >
              Done
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TwoFactorSetup;
