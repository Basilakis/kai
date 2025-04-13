import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  Chip,
  Alert,
  Tabs,
  Tab,
  LinearProgress
} from '@mui/material';
import { 
  getCreditBalance, 
  getCreditTransactions,
  getCreditUsageByService,
  getServiceCosts
} from '../../services/subscriptionService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`credit-tabpanel-${index}`}
      aria-labelledby={`credit-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const CreditUsageDetails: React.FC = () => {
  const [tabValue, setTabValue] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [usageByService, setUsageByService] = useState<Record<string, any>>({});
  const [serviceCosts, setServiceCosts] = useState<any[]>([]);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load data based on active tab
      if (tabValue === 0) {
        // Credit Balance
        const balanceResponse = await getCreditBalance();
        setCreditBalance(balanceResponse.data.balance);
        
        // Credit Transactions
        const transactionsResponse = await getCreditTransactions(20, 0);
        setTransactions(transactionsResponse.data);
      } else if (tabValue === 1) {
        // Credit Usage by Service
        const usageResponse = await getCreditUsageByService(20, 0);
        setUsageByService(usageResponse.data);
        
        // Service Costs
        const costsResponse = await getServiceCosts();
        setServiceCosts(costsResponse.data);
      }
    } catch (err: any) {
      console.error('Error loading credit data:', err);
      setError(err.message || 'Failed to load credit data');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    loadData();
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // Calculate total usage
  const totalUsage = Object.values(usageByService).reduce(
    (sum: number, service: any) => sum + service.totalCredits,
    0
  );

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        Credit Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ mb: 4 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Credit Balance & History" />
          <Tab label="Usage by Service" />
        </Tabs>
        
        {/* Credit Balance & History Tab */}
        <TabPanel value={tabValue} index={0}>
          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Current Balance
                      </Typography>
                      <Typography variant="h3" component="div" color="primary">
                        {creditBalance}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Available Credits
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={8}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Recent Transactions
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Type</TableCell>
                              <TableCell>Description</TableCell>
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
                                  <TableCell>
                                    <Chip
                                      label={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                      color={getTransactionTypeColor(transaction.type) as any}
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell>{transaction.description}</TableCell>
                                  <TableCell align="right" sx={{ 
                                    color: transaction.amount > 0 ? 'success.main' : 'error.main',
                                    fontWeight: 'bold'
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
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              <Box mt={4}>
                <Typography variant="h6" gutterBottom>
                  Transaction History
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Service</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions
                          .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                          .map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                  color={getTransactionTypeColor(transaction.type) as any}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{transaction.description}</TableCell>
                              <TableCell>{transaction.serviceKey || '-'}</TableCell>
                              <TableCell align="right" sx={{ 
                                color: transaction.amount > 0 ? 'success.main' : 'error.main',
                                fontWeight: 'bold'
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
                  count={transactions.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                />
              </Box>
            </>
          )}
        </TabPanel>
        
        {/* Usage by Service Tab */}
        <TabPanel value={tabValue} index={1}>
          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Credit Usage by Service
                      </Typography>
                      
                      {Object.keys(usageByService).length === 0 ? (
                        <Alert severity="info">
                          No service usage data available
                        </Alert>
                      ) : (
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Service</TableCell>
                                <TableCell>Credits Used</TableCell>
                                <TableCell>Percentage</TableCell>
                                <TableCell>Last Used</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(usageByService).map(([serviceKey, data]: [string, any]) => (
                                <TableRow key={serviceKey}>
                                  <TableCell>{serviceKey}</TableCell>
                                  <TableCell>{data.totalCredits}</TableCell>
                                  <TableCell>
                                    <Box display="flex" alignItems="center">
                                      <Box width="100%" mr={1}>
                                        <LinearProgress
                                          variant="determinate"
                                          value={(data.totalCredits / (totalUsage || 1)) * 100}
                                          sx={{ height: 10, borderRadius: 5 }}
                                        />
                                      </Box>
                                      <Box minWidth={35}>
                                        <Typography variant="body2" color="textSecondary">
                                          {((data.totalCredits / (totalUsage || 1)) * 100).toFixed(1)}%
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    {data.transactions && data.transactions.length > 0
                                      ? formatDate(data.transactions[0].createdAt)
                                      : 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Service Pricing
                      </Typography>
                      
                      {serviceCosts.length === 0 ? (
                        <Alert severity="info">
                          No service cost data available
                        </Alert>
                      ) : (
                        <TableContainer>
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Service</TableCell>
                                <TableCell>Cost Per Unit</TableCell>
                                <TableCell>Unit Type</TableCell>
                                <TableCell>Description</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {serviceCosts
                                .filter(cost => cost.isActive)
                                .map((cost) => (
                                  <TableRow key={cost.id}>
                                    <TableCell>{cost.serviceName}</TableCell>
                                    <TableCell>{cost.costPerUnit.toFixed(6)} credits</TableCell>
                                    <TableCell>per {cost.unitType}</TableCell>
                                    <TableCell>{cost.description || '-'}</TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default CreditUsageDetails;
