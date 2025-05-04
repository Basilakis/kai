import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert
} from '@mui/material';
import {
  Psychology as PsychologyIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Help as HelpIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import { api } from '../utils/api';
import MaterialTypeSelector, { MaterialType } from '../../client/src/components/common/MaterialTypeSelector';

/**
 * Active Learning Panel Component
 * 
 * This component allows admins to improve models through active learning.
 */
const ActiveLearningPanel: React.FC<{
  propertyName: string;
  materialType: MaterialType;
  modelId: string;
}> = ({ propertyName, materialType, modelId }) => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState<boolean>(false);
  const [sessionOptions, setSessionOptions] = useState({
    maxSamples: 50,
    minConfidence: 0,
    maxConfidence: 0.8,
    useEntropy: true,
    includeValidationSet: false
  });
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState<boolean>(false);
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [correctValue, setCorrectValue] = useState<string>('');
  const [retrainingDialogOpen, setRetrainingDialogOpen] = useState<boolean>(false);
  const [retraining, setRetraining] = useState<boolean>(false);
  const [improvementMetrics, setImprovementMetrics] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, [propertyName, materialType]);

  // Load active learning sessions
  const loadSessions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/ai/active-learning/sessions', {
        params: {
          propertyName,
          materialType
        }
      });
      
      setSessions(response.data.sessions || []);
      
      // Select the most recent active session if available
      const activeSessions = (response.data.sessions || []).filter((s: any) => s.status === 'active');
      if (activeSessions.length > 0) {
        setSelectedSession(activeSessions[0]);
      }
    } catch (error) {
      console.error('Error loading active learning sessions:', error);
      setError('Error loading active learning sessions');
    } finally {
      setLoading(false);
    }
  };

  // Handle create session dialog open
  const handleOpenCreateSessionDialog = () => {
    setCreateSessionDialogOpen(true);
  };

  // Handle create session dialog close
  const handleCloseCreateSessionDialog = () => {
    setCreateSessionDialogOpen(false);
  };

  // Handle session option change
  const handleSessionOptionChange = (name: string, value: any) => {
    setSessionOptions(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle create session
  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/ai/active-learning/sessions', {
        propertyName,
        materialType,
        modelId,
        options: sessionOptions
      });
      
      handleCloseCreateSessionDialog();
      loadSessions();
      setSelectedSession(response.data.session);
    } catch (error) {
      console.error('Error creating active learning session:', error);
      setError('Error creating active learning session');
    } finally {
      setLoading(false);
    }
  };

  // Handle session selection
  const handleSessionSelect = async (sessionId: string) => {
    setLoading(true);
    try {
      const response = await api.get(`/api/ai/active-learning/sessions/${sessionId}`);
      setSelectedSession(response.data.session);
    } catch (error) {
      console.error('Error loading session details:', error);
      setError('Error loading session details');
    } finally {
      setLoading(false);
    }
  };

  // Handle feedback dialog open
  const handleOpenFeedbackDialog = (sample: any) => {
    setSelectedSample(sample);
    setCorrectValue('');
    setFeedbackDialogOpen(true);
  };

  // Handle feedback dialog close
  const handleCloseFeedbackDialog = () => {
    setFeedbackDialogOpen(false);
    setSelectedSample(null);
  };

  // Handle provide feedback
  const handleProvideFeedback = async () => {
    if (!selectedSample || !correctValue) {
      setError('Please provide a correct value');
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.post(`/api/ai/active-learning/sessions/${selectedSession.id}/feedback`, {
        sampleId: selectedSample.id,
        correctValue
      });
      
      handleCloseFeedbackDialog();
      setSelectedSession(response.data.session);
    } catch (error) {
      console.error('Error providing feedback:', error);
      setError('Error providing feedback');
    } finally {
      setLoading(false);
    }
  };

  // Handle retrain dialog open
  const handleOpenRetrainingDialog = () => {
    setRetrainingDialogOpen(true);
    setImprovementMetrics(null);
  };

  // Handle retrain dialog close
  const handleCloseRetrainingDialog = () => {
    setRetrainingDialogOpen(false);
  };

  // Handle retrain model
  const handleRetrainModel = async () => {
    setRetraining(true);
    try {
      const response = await api.post(`/api/ai/active-learning/sessions/${selectedSession.id}/retrain`);
      setImprovementMetrics(response.data.improvementMetrics);
    } catch (error) {
      console.error('Error retraining model:', error);
      setError('Error retraining model');
    } finally {
      setRetraining(false);
    }
  };

  // Get session status color
  const getSessionStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'warning';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence < 0.5) return 'error';
    if (confidence < 0.8) return 'warning';
    return 'success';
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        <PsychologyIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Active Learning: {propertyName} ({materialType})
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Active Learning Sessions
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateSessionDialog}
          >
            Create Session
          </Button>
        </Box>
        
        {loading && !selectedSession ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : sessions.length === 0 ? (
          <Alert severity="info">
            No active learning sessions found for this property. Create a session to get started.
          </Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Session ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow 
                    key={session.id}
                    selected={selectedSession?.id === session.id}
                    hover
                    onClick={() => handleSessionSelect(session.id)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{session.id.split('-').slice(-1)[0]}</TableCell>
                    <TableCell>
                      <Chip
                        label={session.status}
                        size="small"
                        color={getSessionStatusColor(session.status)}
                      />
                    </TableCell>
                    <TableCell>{new Date(session.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LinearProgress
                          variant="determinate"
                          value={session.progress * 100}
                          sx={{ flexGrow: 1, mr: 1 }}
                        />
                        <Typography variant="body2">
                          {Math.round(session.progress * 100)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionSelect(session.id);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      
      {selectedSession && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Session Details: {selectedSession.id.split('-').slice(-1)[0]}
            </Typography>
            <Box>
              {selectedSession.status === 'active' && (
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleOpenRetrainingDialog}
                  disabled={selectedSession.progress < 1}
                  sx={{ mr: 1 }}
                >
                  Retrain Model
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => handleSessionSelect(selectedSession.id)}
              >
                Refresh
              </Button>
            </Box>
          </Box>
          
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Session Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Status:</strong> {selectedSession.status}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Created:</strong> {new Date(selectedSession.createdAt).toLocaleString()}
                  </Typography>
                  {selectedSession.completedAt && (
                    <Typography variant="body2">
                      <strong>Completed:</strong> {new Date(selectedSession.completedAt).toLocaleString()}
                    </Typography>
                  )}
                  <Typography variant="body2">
                    <strong>Model ID:</strong> {selectedSession.modelId}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Progress
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Samples:</strong> {selectedSession.samples.length}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Feedback Provided:</strong> {selectedSession.samples.filter((s: any) => !s.needsFeedback).length} / {selectedSession.samples.length}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={selectedSession.progress * 100}
                      sx={{ flexGrow: 1, mr: 1 }}
                    />
                    <Typography variant="body2">
                      {Math.round(selectedSession.progress * 100)}%
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
            
            {selectedSession.improvementMetrics && (
              <Grid item xs={12}>
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    Improvement Metrics
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2">
                        <strong>Initial Accuracy:</strong> {(selectedSession.improvementMetrics.initialAccuracy * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2">
                        <strong>Final Accuracy:</strong> {(selectedSession.improvementMetrics.finalAccuracy * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2">
                        <strong>Improvement:</strong> {(selectedSession.improvementMetrics.accuracyImprovement * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Typography variant="body2">
                        <strong>Confusion Reduction:</strong> {(selectedSession.improvementMetrics.confusionReduction * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}
          </Grid>
          
          <Typography variant="subtitle2" gutterBottom>
            Uncertain Samples
          </Typography>
          
          {selectedSession.samples.length === 0 ? (
            <Alert severity="info">
              No uncertain samples found for this session.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {selectedSession.samples.map((sample: any) => (
                <Grid item xs={12} sm={6} md={4} key={sample.id}>
                  <Card>
                    <CardMedia
                      component="img"
                      height="140"
                      image={`/api/ai/visual-reference/image?path=${encodeURIComponent(sample.imagePath)}`}
                      alt="Uncertain sample"
                    />
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2">
                          Predictions
                        </Typography>
                        {sample.needsFeedback ? (
                          <Chip
                            icon={<HelpIcon />}
                            label="Needs Feedback"
                            size="small"
                            color="warning"
                          />
                        ) : (
                          <Chip
                            icon={<CheckIcon />}
                            label="Feedback Provided"
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>
                      
                      {sample.predictions.slice(0, 3).map((prediction: any, index: number) => (
                        <Box key={index} sx={{ mb: 0.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              {prediction.value}
                            </Typography>
                            <Chip
                              label={`${(prediction.confidence * 100).toFixed(0)}%`}
                              size="small"
                              color={getConfidenceColor(prediction.confidence)}
                            />
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={prediction.confidence * 100}
                            color={getConfidenceColor(prediction.confidence)}
                            sx={{ height: 4, mb: 1 }}
                          />
                        </Box>
                      ))}
                      
                      {sample.userFeedback ? (
                        <Box sx={{ mt: 2, p: 1, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'success.light' }}>
                          <Typography variant="body2" color="success.main">
                            <strong>Correct Value:</strong> {sample.userFeedback.correctValue}
                          </Typography>
                        </Box>
                      ) : (
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={() => handleOpenFeedbackDialog(sample)}
                          sx={{ mt: 1 }}
                        >
                          Provide Feedback
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}
      
      {/* Create Session Dialog */}
      <Dialog
        open={createSessionDialogOpen}
        onClose={handleCloseCreateSessionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Active Learning Session</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Create a new active learning session for {propertyName} ({materialType}).
              The system will find uncertain samples that need human feedback.
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Samples"
                  type="number"
                  value={sessionOptions.maxSamples}
                  onChange={(e) => handleSessionOptionChange('maxSamples', parseInt(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 1, max: 100 }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Use Entropy</InputLabel>
                  <Select
                    value={sessionOptions.useEntropy ? 'true' : 'false'}
                    onChange={(e) => handleSessionOptionChange('useEntropy', e.target.value === 'true')}
                    label="Use Entropy"
                  >
                    <MenuItem value="true">Yes - Better for multi-class</MenuItem>
                    <MenuItem value="false">No - Use confidence only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Min Confidence"
                  type="number"
                  value={sessionOptions.minConfidence}
                  onChange={(e) => handleSessionOptionChange('minConfidence', parseFloat(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 0, max: 1, step: 0.1 }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Max Confidence"
                  type="number"
                  value={sessionOptions.maxConfidence}
                  onChange={(e) => handleSessionOptionChange('maxConfidence', parseFloat(e.target.value))}
                  fullWidth
                  margin="normal"
                  InputProps={{
                    inputProps: { min: 0, max: 1, step: 0.1 }
                  }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Include Validation Set</InputLabel>
                  <Select
                    value={sessionOptions.includeValidationSet ? 'true' : 'false'}
                    onChange={(e) => handleSessionOptionChange('includeValidationSet', e.target.value === 'true')}
                    label="Include Validation Set"
                  >
                    <MenuItem value="true">Yes - Include validation data</MenuItem>
                    <MenuItem value="false">No - Only use unlabeled data</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" color="primary">
                Active Learning Process
              </Typography>
              <Typography variant="body2">
                The system will find samples where the model is uncertain about its predictions.
                You'll provide feedback on these samples, which will be used to improve the model.
                This process helps the model learn from difficult cases and improve its accuracy.
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateSessionDialog}>Cancel</Button>
          <Button
            onClick={handleCreateSession}
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Session'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Feedback Dialog */}
      <Dialog
        open={feedbackDialogOpen}
        onClose={handleCloseFeedbackDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Provide Feedback</DialogTitle>
        <DialogContent>
          {selectedSample && (
            <Box sx={{ pt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <img
                  src={`/api/ai/visual-reference/image?path=${encodeURIComponent(selectedSample.imagePath)}`}
                  alt="Uncertain sample"
                  style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                />
              </Box>
              
              <Typography variant="subtitle2" gutterBottom>
                Model Predictions
              </Typography>
              
              {selectedSample.predictions.slice(0, 3).map((prediction: any, index: number) => (
                <Box key={index} sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">
                      {prediction.value}
                    </Typography>
                    <Chip
                      label={`${(prediction.confidence * 100).toFixed(0)}%`}
                      size="small"
                      color={getConfidenceColor(prediction.confidence)}
                    />
                  </Box>
                </Box>
              ))}
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                Your Feedback
              </Typography>
              
              <TextField
                label="Correct Value"
                value={correctValue}
                onChange={(e) => setCorrectValue(e.target.value)}
                fullWidth
                required
                margin="normal"
                helperText="Enter the correct value for this sample"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseFeedbackDialog}>Cancel</Button>
          <Button
            onClick={handleProvideFeedback}
            variant="contained"
            color="primary"
            disabled={!correctValue || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Retraining Dialog */}
      <Dialog
        open={retrainingDialogOpen}
        onClose={handleCloseRetrainingDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Retrain Model</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <Typography variant="body1" paragraph>
              Retrain the model using the feedback provided in this active learning session.
              This will update the model to improve its accuracy on uncertain cases.
            </Typography>
            
            {improvementMetrics ? (
              <Box sx={{ mt: 2 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">
                    Model Successfully Retrained!
                  </Typography>
                  <Typography variant="body2">
                    The model has been updated with the feedback from this session.
                  </Typography>
                </Alert>
                
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <SchoolIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Improvement Metrics
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Accuracy
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Initial:</Typography>
                          <Typography variant="body2" fontWeight="bold">
                            {(improvementMetrics.initialAccuracy * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Final:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {(improvementMetrics.finalAccuracy * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Improvement:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            +{(improvementMetrics.accuracyImprovement * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Confusion Reduction
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2">Reduction:</Typography>
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {(improvementMetrics.confusionReduction * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 2 }}>
                          This means the model is {(improvementMetrics.confusionReduction * 100).toFixed(1)}% less likely to confuse different classes.
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Box>
            ) : (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" color="primary">
                  Retraining Process
                </Typography>
                <Typography variant="body2">
                  The system will use the feedback provided to update the model.
                  This process may take a few minutes to complete.
                  The model will be updated to better recognize the uncertain cases.
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRetrainingDialog}>
            {improvementMetrics ? 'Close' : 'Cancel'}
          </Button>
          {!improvementMetrics && (
            <Button
              onClick={handleRetrainModel}
              variant="contained"
              color="primary"
              disabled={retraining}
            >
              {retraining ? <CircularProgress size={24} /> : 'Retrain Model'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActiveLearningPanel;
