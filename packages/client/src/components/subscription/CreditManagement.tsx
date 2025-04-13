import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { 
  getCreditBalance, 
  getCreditTransactions, 
  purchaseCredits 
} from '../../services/subscriptionService';
import { CreditTransaction } from '../../types/subscription';
import PaymentMethodSelector from './PaymentMethodSelector';

const CreditManagement: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [purchaseAmount, setPurchaseAmount] = useState<number>(100);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [purchaseLoading, setPurchaseLoading] = useState<boolean>(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch credit balance
      const balanceResponse = await getCreditBalance();
      setBalance(balanceResponse.data.balance);
      
      // Fetch credit transactions
      const transactionsResponse = await getCreditTransactions(rowsPerPage, page * rowsPerPage);
      setTransactions(transactionsResponse.data);
    } catch (err: any) {
      console.error('Error loading credit data:', err);
      setError(err.message || 'Failed to load credit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, rowsPerPage]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handlePurchaseDialogOpen = () => {
    setPurchaseDialogOpen(true);
    setPurchaseError(null);
    setPurchaseSuccess(false);
  };

  const handlePurchaseDialogClose = () => {
    setPurchaseDialogOpen(false);
    // If purchase was successful, reload data
    if (purchaseSuccess) {
      loadData();
    }
  };

  const handlePurchaseCredits = async () => {
    if (!selectedPaymentMethod) {
      setPurchaseError('Please select a payment method');
      return;
    }

    try {
      setPurchaseLoading(true);
      setPurchaseError(null);
      
      // Purchase credits
      await purchaseCredits(purchaseAmount, selectedPaymentMethod);
      
      setPurchaseSuccess(true);
    } catch (err: any) {
      console.error('Error purchasing credits:', err);
      setPurchaseError(err.message || 'Failed to purchase credits');
    } finally {
      setPurchaseLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'purchase':
        return 'success';
      case 'usage':
        return 'error';
      case 'refund':
        return 'info';
      case 'subscription':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Credit Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Credit Balance</Typography>
                <IconButton size="small" onClick={loadData} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Box>
              
              {loading ? (
                <Box display="flex" justifyContent="center" my={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <Typography variant="h3" component="div" sx={{ my: 2 }}>
                  {balance}
                </Typography>
              )}
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                fullWidth
                onClick={handlePurchaseDialogOpen}
              >
                Purchase Credits
              </Button>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Credit Usage
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Credits are used for premium features like generating 3D models, running AI agents, and more.
                Each credit represents a unit of computational resources.
              </Typography>
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Credit Pricing
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">$10</Typography>
                      <Typography variant="body2">100 Credits</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">$25</Typography>
                      <Typography variant="body2">300 Credits</Typography>
                      <Typography variant="caption" color="success.main">
                        Save 17%
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">$45</Typography>
                      <Typography variant="body2">600 Credits</Typography>
                      <Typography variant="caption" color="success.main">
                        Save 25%
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">$80</Typography>
                      <Typography variant="body2">1200 Credits</Typography>
                      <Typography variant="caption" color="success.main">
                        Save 33%
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Transaction History
              </Typography>
              
              {loading ? (
                <Box display="flex" justifyContent="center" my={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell align="right">Balance</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {transactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              No transactions found
                            </TableCell>
                          </TableRow>
                        ) : (
                          transactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                              <TableCell>{transaction.description}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)} 
                                  color={getTransactionTypeColor(transaction.type) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="right" sx={{
                                color: transaction.amount > 0 ? 'success.main' : 'error.main'
                              }}>
                                {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                              </TableCell>
                              <TableCell align="right">{transaction.balance}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <TablePagination
                    component="div"
                    count={-1} // We don't know the total count, so use -1 to show "..."
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Purchase Credits Dialog */}
      <Dialog open={purchaseDialogOpen} onClose={handlePurchaseDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>Purchase Credits</DialogTitle>
        <DialogContent>
          {purchaseSuccess ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Credits purchased successfully!
            </Alert>
          ) : (
            <>
              <DialogContentText>
                Enter the amount of credits you want to purchase. Each credit costs $0.10.
              </DialogContentText>
              
              <TextField
                label="Credit Amount"
                type="number"
                fullWidth
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(Math.max(1, parseInt(e.target.value) || 0))}
                margin="normal"
                InputProps={{
                  inputProps: { min: 1 }
                }}
              />
              
              <Box sx={{ my: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Total Cost: ${(purchaseAmount * 0.1).toFixed(2)}
                </Typography>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Payment Method
              </Typography>
              
              <PaymentMethodSelector
                onSelectPaymentMethod={setSelectedPaymentMethod}
                selectedPaymentMethod={selectedPaymentMethod}
              />
              
              {purchaseError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {purchaseError}
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePurchaseDialogClose}>
            {purchaseSuccess ? 'Close' : 'Cancel'}
          </Button>
          {!purchaseSuccess && (
            <Button 
              onClick={handlePurchaseCredits} 
              variant="contained" 
              color="primary"
              disabled={purchaseLoading || !selectedPaymentMethod}
            >
              {purchaseLoading ? <CircularProgress size={24} /> : 'Purchase'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CreditManagement;
