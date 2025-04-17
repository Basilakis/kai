import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { api } from '../../services/api';

interface TransferHistory {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  fromUser?: {
    id: string;
    email: string;
    name?: string;
  };
  toUser?: {
    id: string;
    email: string;
    name?: string;
  };
  direction: 'sent' | 'received';
}

interface User {
  id: string;
  email: string;
  name?: string;
}

const CreditTransfer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [tabValue, setTabValue] = useState(0);
  const [transferHistory, setTransferHistory] = useState<TransferHistory[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientUser, setRecipientUser] = useState<User | null>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [error, setError] = useState('');

  // Fetch credit balance and transfer history
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch credit balance
        const balanceResponse = await api.get('/credits/balance');
        setCreditBalance(balanceResponse.data.data.balance);
        
        // Fetch transfer history
        const historyResponse = await api.get('/credits/transfer/history');
        setTransferHistory(historyResponse.data.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to fetch credit data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Find user by email
  const handleFindUser = async () => {
    if (!recipientEmail) {
      setError('Email is required');
      return;
    }
    
    setSearching(true);
    setError('');
    setRecipientUser(null);
    
    try {
      const response = await api.get(`/credits/transfer/find-user?email=${encodeURIComponent(recipientEmail)}`);
      setRecipientUser(response.data.data);
    } catch (error) {
      console.error('Error finding user:', error);
      setError('User not found or you cannot transfer credits to this user');
      toast.error('User not found');
    } finally {
      setSearching(false);
    }
  };

  // Transfer credits
  const handleTransferCredits = async () => {
    if (!recipientUser) {
      setError('Recipient is required');
      return;
    }
    
    if (!amount || amount <= 0) {
      setError('Amount must be positive');
      return;
    }
    
    if (amount > creditBalance) {
      setError(`Insufficient credits. You have ${creditBalance} credits available.`);
      return;
    }
    
    setTransferring(true);
    setError('');
    
    try {
      await api.post('/credits/transfer', {
        toUserId: recipientUser.id,
        amount,
        note
      });
      
      // Update credit balance
      setCreditBalance(prevBalance => prevBalance - amount);
      
      // Refresh transfer history
      const historyResponse = await api.get('/credits/transfer/history');
      setTransferHistory(historyResponse.data.data);
      
      // Reset form
      setRecipientEmail('');
      setRecipientUser(null);
      setAmount(0);
      setNote('');
      
      setOpenConfirmDialog(false);
      
      toast.success(`Successfully transferred ${amount} credits`);
    } catch (error) {
      console.error('Error transferring credits:', error);
      setError('Failed to transfer credits');
      toast.error('Failed to transfer credits');
    } finally {
      setTransferring(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  };

  // Render transfer form
  const renderTransferForm = () => (
    <Box>
      <Typography variant="body1" paragraph>
        Transfer credits to another user. The recipient will receive the credits immediately.
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Available Credits
        </Typography>
        <Typography variant="h5" color="primary">
          {creditBalance} credits
        </Typography>
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              label="Recipient Email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="colleague@example.com"
              sx={{ mr: 1 }}
            />
            <Button
              variant="contained"
              onClick={handleFindUser}
              disabled={searching || !recipientEmail}
              startIcon={searching ? <CircularProgress size={20} /> : <SearchIcon />}
            >
              Find
            </Button>
          </Box>
        </Grid>
        
        {recipientUser && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
              <Typography variant="body1">
                Recipient: {recipientUser.name || recipientUser.email}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {recipientUser.email}
              </Typography>
            </Paper>
          </Grid>
        )}
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Amount"
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(parseInt(e.target.value))}
            disabled={!recipientUser}
            InputProps={{
              endAdornment: <InputAdornment position="end">credits</InputAdornment>,
            }}
          />
        </Grid>
        
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!recipientUser}
            placeholder="What's this transfer for?"
            multiline
            rows={2}
          />
        </Grid>
      </Grid>
      
      {error && (
        <Typography color="error" variant="body2" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setOpenConfirmDialog(true)}
          disabled={!recipientUser || !amount || amount <= 0 || amount > creditBalance}
        >
          Transfer Credits
        </Button>
      </Box>
    </Box>
  );

  // Render transfer history
  const renderTransferHistory = () => (
    <Box>
      <Typography variant="body1" paragraph>
        View your credit transfer history.
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : transferHistory.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">
            You haven't made any credit transfers yet.
          </Typography>
        </Paper>
      ) : (
        <Box>
          {transferHistory.map((transfer) => (
            <Paper key={transfer.id} sx={{ p: 2, mb: 2, borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                {transfer.direction === 'sent' ? (
                  <>
                    <ArrowForwardIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="body1" color="error">
                      Sent {transfer.amount} credits
                    </Typography>
                  </>
                ) : (
                  <>
                    <ArrowBackIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="body1" color="success">
                      Received {transfer.amount} credits
                    </Typography>
                  </>
                )}
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                {transfer.direction === 'sent' ? 'To: ' : 'From: '}
                {transfer.direction === 'sent' 
                  ? (transfer.toUser?.name || transfer.toUser?.email) 
                  : (transfer.fromUser?.name || transfer.fromUser?.email)}
              </Typography>
              
              {transfer.note && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Note: {transfer.note}
                </Typography>
              )}
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(transfer.createdAt)}
                </Typography>
                <Typography variant="caption" color={
                  transfer.status === 'completed' ? 'success.main' : 
                  transfer.status === 'failed' ? 'error.main' : 'warning.main'
                }>
                  {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                </Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <Card>
      <CardHeader title="Credit Transfers" />
      <CardContent>
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="credit transfer tabs">
            <Tab label="Transfer Credits" id="tab-0" aria-controls="tabpanel-0" />
            <Tab label="Transfer History" id="tab-1" aria-controls="tabpanel-1" />
          </Tabs>
          
          <Box role="tabpanel" hidden={tabValue !== 0} id="tabpanel-0" aria-labelledby="tab-0" sx={{ p: 3 }}>
            {tabValue === 0 && renderTransferForm()}
          </Box>
          
          <Box role="tabpanel" hidden={tabValue !== 1} id="tabpanel-1" aria-labelledby="tab-1" sx={{ p: 3 }}>
            {tabValue === 1 && renderTransferHistory()}
          </Box>
        </Paper>
        
        {/* Confirm Transfer Dialog */}
        <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)}>
          <DialogTitle>Confirm Credit Transfer</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to transfer {amount} credits to {recipientUser?.name || recipientUser?.email}?
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenConfirmDialog(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="primary"
              onClick={handleTransferCredits}
              disabled={transferring}
            >
              {transferring ? <CircularProgress size={24} /> : 'Confirm Transfer'}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default CreditTransfer;
