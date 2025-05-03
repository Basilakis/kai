import React from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import Layout from '../components/Layout';
// Import the dependency service
import dependencyService from '../services/dependency-service';
// Import icons using the project's established pattern
import {
  RefreshIcon,
  CheckCircleIcon,
  WarningIcon,
  UpdateIcon,
  ErrorIcon,
  ExpandMoreIcon
} from '../components/mui-icons';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface PackageUpdate {
  name: string;
  current: string;
  latest: string;
  updateType: 'major' | 'minor' | 'patch';
  packageType: 'node' | 'python';
  analysis?: {
    breakingChange: boolean;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
    affectedAreas: string[];
    configChangesNeeded: boolean;
    recommendation: 'safe' | 'caution' | 'manual-update';
    potentialConfigFiles: string[];
  };
}

interface PackageSummary {
  total: number;
  major: number;
  minor: number;
  patch: number;
  safe: number;
  caution: number;
  manualUpdate: number;
}

const DependencyManagementPage: React.FC = () => {
  const [tabValue, setTabValue] = React.useState(0);
  const [nodePackages, setNodePackages] = React.useState<PackageUpdate[]>([]);
  const [pythonPackages, setPythonPackages] = React.useState<PackageUpdate[]>([]);
  const [summary, setSummary] = React.useState<PackageSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [scanRunning, setScanRunning] = React.useState(false);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [selectedPackages, setSelectedPackages] = React.useState<PackageUpdate[]>([]);
  const [updateType, setUpdateType] = React.useState<'safe' | 'caution' | 'manual'>('safe');

  // Fetch dependencies on component mount
  React.useEffect(() => {
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dependencyService.getOutdatedPackages();

      // Split packages by type
      const node = data.packages.filter((pkg: PackageUpdate) => pkg.packageType === 'node');
      const python = data.packages.filter((pkg: PackageUpdate) => pkg.packageType === 'python');

      setNodePackages(node);
      setPythonPackages(python);
      setSummary(data.summary);

    } catch (err) {
      setError('Failed to fetch dependency data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleStartScan = async () => {
    setScanRunning(true);
    try {
      await dependencyService.triggerDependencyScan();
      // Poll for completion or show notification when done
      const interval = setInterval(async () => {
        const status = await dependencyService.getScanStatus();
        if (status.completed) {
          clearInterval(interval);
          setScanRunning(false);
          fetchDependencies();
        }
      }, 10000);
    } catch (err) {
      setError('Failed to start dependency scan. Please try again.');
      console.error(err);
      setScanRunning(false);
    }
  };

  const handleUpdateSelected = (updateType: 'safe' | 'caution' | 'manual') => {
    setUpdateType(updateType);

    let packagesToUpdate: PackageUpdate[] = [];

    // Filter packages based on update type
    if (updateType === 'safe') {
      packagesToUpdate = [...nodePackages, ...pythonPackages].filter(
        (pkg: PackageUpdate) => pkg.analysis?.recommendation === 'safe'
      );
    } else if (updateType === 'caution') {
      packagesToUpdate = [...nodePackages, ...pythonPackages].filter(
        (pkg: PackageUpdate) => pkg.analysis?.recommendation === 'caution'
      );
    } else {
      packagesToUpdate = [...nodePackages, ...pythonPackages].filter(
        (pkg: PackageUpdate) => pkg.analysis?.recommendation === 'manual-update'
      );
    }

    setSelectedPackages(packagesToUpdate);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleConfirmUpdate = async () => {
    setOpenDialog(false);
    setLoading(true);

    try {
      const packageNames = selectedPackages.map((pkg: PackageUpdate) => pkg.name);
      await dependencyService.updatePackages(packageNames, updateType);
      // Refresh data after update
      fetchDependencies();
    } catch (err) {
      setError('Failed to update packages. Please try again or check logs.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render status chip
  const renderStatusChip = (pkg: PackageUpdate) => {
    if (!pkg.analysis) return null;

    switch (pkg.analysis.recommendation) {
      case 'safe':
        return <Chip
          label="Safe"
          color="success"
          size="small"
          icon={<CheckCircleIcon />}
        />;
      case 'caution':
        return <Chip
          label="Caution"
          color="warning"
          size="small"
          icon={<WarningIcon />}
        />;
      case 'manual-update':
        return <Chip
          label="Manual Review"
          color="error"
          size="small"
          icon={<ErrorIcon />}
        />;
      default:
        return null;
    }
  };

  // Helper to render update type chip
  const renderUpdateTypeChip = (updateType: string) => {
    switch (updateType) {
      case 'major':
        return <Chip label="Major" color="error" size="small" />;
      case 'minor':
        return <Chip label="Minor" color="warning" size="small" />;
      case 'patch':
        return <Chip label="Patch" color="success" size="small" />;
      default:
        return <Chip label="Unknown" size="small" />;
    }
  };

  // Render package table
  const renderPackageTable = (packages: PackageUpdate[]) => {
    if (packages.length === 0) {
      return <Typography>No outdated packages found.</Typography>;
    }

    return (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Package Name</TableCell>
              <TableCell>Current Version</TableCell>
              <TableCell>Latest Version</TableCell>
              <TableCell>Update Type</TableCell>
              <TableCell>Recommendation</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.map((pkg) => (
              <TableRow key={pkg.name}>
                <TableCell>{pkg.name}</TableCell>
                <TableCell>{pkg.current}</TableCell>
                <TableCell>{pkg.latest}</TableCell>
                <TableCell>{renderUpdateTypeChip(pkg.updateType)}</TableCell>
                <TableCell>{renderStatusChip(pkg)}</TableCell>
                <TableCell>
                  {pkg.analysis && (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="body2">Analysis Details</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="body2" gutterBottom>
                          <strong>Confidence:</strong> {pkg.analysis.confidence}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Breaking Change:</strong> {pkg.analysis.breakingChange ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Reasoning:</strong> {pkg.analysis.reasoning}
                        </Typography>
                        {pkg.analysis.affectedAreas.length > 0 && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Affected Areas:</strong> {pkg.analysis.affectedAreas.join(', ')}
                          </Typography>
                        )}
                        {pkg.analysis.configChangesNeeded && (
                          <Box mt={1}>
                            <Typography variant="body2" color="error">
                              <strong>Configuration changes may be needed!</strong>
                            </Typography>
                            {pkg.analysis.potentialConfigFiles.length > 0 && (
                              <Typography variant="body2">
                                <strong>Potential Config Files:</strong> {pkg.analysis.potentialConfigFiles.join(', ')}
                              </Typography>
                            )}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Layout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Dependency Management
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchDependencies}
              sx={{ mr: 1 }}
              disabled={loading || scanRunning}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<UpdateIcon />}
              onClick={handleStartScan}
              disabled={loading || scanRunning}
            >
              {scanRunning ? 'Scan Running...' : 'Start New Scan'}
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : (
          <>
            {summary && (
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Outdated
                    </Typography>
                    <Typography variant="h5">
                      {summary.total}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Major Updates
                    </Typography>
                    <Typography variant="h5" color="error.main">
                      {summary.major}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Minor Updates
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      {summary.minor}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Patch Updates
                    </Typography>
                    <Typography variant="h5" color="success.main">
                      {summary.patch}
                    </Typography>
                  </Box>
                  <Box sx={{ ml: 'auto' }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => handleUpdateSelected('safe')}
                      disabled={summary.safe === 0}
                      sx={{ mr: 1 }}
                    >
                      Update Safe ({summary.safe})
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={() => handleUpdateSelected('caution')}
                      disabled={summary.caution === 0}
                      sx={{ mr: 1 }}
                    >
                      Update With Caution ({summary.caution})
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => handleUpdateSelected('manual')}
                      disabled={summary.manualUpdate === 0}
                    >
                      Review Manual ({summary.manualUpdate})
                    </Button>
                  </Box>
                </Box>
              </Paper>
            )}

            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label={`Node.js Packages (${nodePackages.length})`} id="tab-0" />
                <Tab label={`Python Packages (${pythonPackages.length})`} id="tab-1" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              {renderPackageTable(nodePackages)}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              {renderPackageTable(pythonPackages)}
            </TabPanel>
          </>
        )}
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
      >
        <DialogTitle>
          Confirm Package Updates
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {updateType === 'safe'
              ? 'You are about to update packages that have been analyzed as safe.'
              : updateType === 'caution'
                ? 'You are about to update packages that require caution. Make sure you have reviewed the potential impacts.'
                : 'You are about to update packages that require manual review. This is not recommended without thorough testing.'}
          </DialogContentText>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {selectedPackages.length} packages will be updated:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #eee', p: 1, borderRadius: 1 }}>
              {selectedPackages.map((pkg: PackageUpdate) => (
                <Typography key={pkg.name} variant="body2" gutterBottom>
                  • {pkg.name}: {pkg.current} → {pkg.latest} ({pkg.packageType})
                </Typography>
              ))}
            </Box>
            {updateType !== 'safe' && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                These updates may require additional changes to configuration files or code. Please ensure you have proper backups and testing environments in place.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmUpdate}
            variant="contained"
            color={updateType === 'safe' ? 'success' : updateType === 'caution' ? 'warning' : 'error'}
          >
            Confirm Update
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default DependencyManagementPage;