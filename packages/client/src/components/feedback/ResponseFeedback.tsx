import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Rating,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Star as StarIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import responseQualityService from '../../services/response-quality.service';

// Feedback types
export enum FeedbackType {
  THUMBS_UP = 'thumbs_up',
  THUMBS_DOWN = 'thumbs_down',
  STAR_RATING = 'star_rating',
  DETAILED = 'detailed'
}

// Error categories
export enum ErrorCategory {
  FACTUAL_ERROR = 'factual_error',
  HALLUCINATION = 'hallucination',
  INCOMPLETE_ANSWER = 'incomplete_answer',
  MISUNDERSTOOD_QUERY = 'misunderstood_query',
  IRRELEVANT = 'irrelevant',
  OTHER = 'other'
}

// Props interface
interface ResponseFeedbackProps {
  responseId: string;
  modelId: string;
  query: string;
  response: string;
  variant?: 'thumbs' | 'stars' | 'full';
  onFeedbackSubmitted?: (feedback: any) => void;
}

/**
 * Response Feedback Component
 * 
 * This component provides a UI for collecting user feedback on model responses.
 * It supports three variants:
 * - thumbs: Simple thumbs up/down buttons
 * - stars: 5-star rating system
 * - full: Comprehensive feedback form with error categories and comments
 */
const ResponseFeedback: React.FC<ResponseFeedbackProps> = ({
  responseId,
  modelId,
  query,
  response,
  variant = 'thumbs',
  onFeedbackSubmitted
}) => {
  const { user } = useAuth();
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [isPositive, setIsPositive] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [errorCategory, setErrorCategory] = useState<ErrorCategory | ''>('');
  const [feedbackText, setFeedbackText] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(false);

  // Handle thumbs up click
  const handleThumbsUp = () => {
    if (variant === 'thumbs') {
      submitFeedback(FeedbackType.THUMBS_UP, true);
    } else {
      setFeedbackType(FeedbackType.THUMBS_UP);
      setIsPositive(true);
      setDialogOpen(true);
    }
  };

  // Handle thumbs down click
  const handleThumbsDown = () => {
    if (variant === 'thumbs') {
      submitFeedback(FeedbackType.THUMBS_DOWN, false);
    } else {
      setFeedbackType(FeedbackType.THUMBS_DOWN);
      setIsPositive(false);
      setDialogOpen(true);
    }
  };

  // Handle star rating change
  const handleRatingChange = (_event: React.SyntheticEvent, newValue: number | null) => {
    setRating(newValue);
    
    if (variant === 'stars' && newValue !== null) {
      submitFeedback(FeedbackType.STAR_RATING, newValue >= 4, newValue);
    } else if (newValue !== null) {
      setFeedbackType(FeedbackType.STAR_RATING);
      setDialogOpen(true);
    }
  };

  // Handle error category change
  const handleErrorCategoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorCategory(event.target.value as ErrorCategory);
  };

  // Handle feedback text change
  const handleFeedbackTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFeedbackText(event.target.value);
  };

  // Handle dialog close
  const handleDialogClose = () => {
    setDialogOpen(false);
  };

  // Handle feedback submission
  const handleSubmit = () => {
    if (!feedbackType) return;
    
    submitFeedback(
      feedbackType,
      isPositive,
      rating,
      errorCategory as ErrorCategory || undefined,
      feedbackText || undefined
    );
    
    setDialogOpen(false);
  };

  // Submit feedback to the server
  const submitFeedback = async (
    type: FeedbackType,
    positive: boolean | null = null,
    stars: number | null = null,
    category: ErrorCategory | undefined = undefined,
    text: string | undefined = undefined
  ) => {
    if (!user) {
      setSnackbarMessage('You must be logged in to submit feedback');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    setLoading(true);
    
    try {
      const feedback = {
        responseId,
        userId: user.id,
        modelId,
        feedbackType: type,
        isPositive: positive,
        rating: stars,
        errorCategory: category,
        feedbackText: text
      };
      
      const result = await responseQualityService.recordFeedback(feedback);
      
      setSnackbarMessage('Thank you for your feedback!');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // Call the callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      setSnackbarMessage('Failed to submit feedback. Please try again.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
      resetForm();
    }
  };

  // Reset the form
  const resetForm = () => {
    setFeedbackType(null);
    setIsPositive(null);
    setRating(null);
    setErrorCategory('');
    setFeedbackText('');
  };

  // Handle snackbar close
  const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
        {variant === 'thumbs' && (
          <>
            <Typography variant="body2" color="text.secondary">
              Was this response helpful?
            </Typography>
            <Tooltip title="Helpful">
              <IconButton 
                onClick={handleThumbsUp} 
                color="primary"
                disabled={loading}
              >
                <ThumbUpIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Not helpful">
              <IconButton 
                onClick={handleThumbsDown} 
                color="primary"
                disabled={loading}
              >
                <ThumbDownIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
        
        {variant === 'stars' && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
              Rate this response:
            </Typography>
            <Rating
              name="response-rating"
              value={rating}
              onChange={handleRatingChange}
              disabled={loading}
            />
          </Box>
        )}
        
        {variant === 'full' && (
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => setDialogOpen(true)}
            disabled={loading}
          >
            Provide Feedback
          </Button>
        )}
      </Box>
      
      {/* Feedback Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Response Feedback
          <IconButton
            aria-label="close"
            onClick={handleDialogClose}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Query:</Typography>
            <Typography variant="body2" sx={{ backgroundColor: 'grey.100', p: 1, borderRadius: 1 }}>
              {query}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom>Response:</Typography>
            <Typography variant="body2" sx={{ backgroundColor: 'grey.100', p: 1, borderRadius: 1 }}>
              {response}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">How would you rate this response?</FormLabel>
              <Rating
                name="feedback-rating"
                value={rating}
                onChange={(_event, newValue) => setRating(newValue)}
                sx={{ mt: 1 }}
              />
            </FormControl>
          </Box>
          
          {(isPositive === false || (rating !== null && rating <= 3)) && (
            <Box sx={{ mb: 3 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend">What was the issue with this response?</FormLabel>
                <RadioGroup
                  aria-label="error-category"
                  name="error-category"
                  value={errorCategory}
                  onChange={handleErrorCategoryChange}
                >
                  <FormControlLabel value={ErrorCategory.FACTUAL_ERROR} control={<Radio />} label="Contains factual errors" />
                  <FormControlLabel value={ErrorCategory.HALLUCINATION} control={<Radio />} label="Contains made-up information" />
                  <FormControlLabel value={ErrorCategory.INCOMPLETE_ANSWER} control={<Radio />} label="Incomplete or partial answer" />
                  <FormControlLabel value={ErrorCategory.MISUNDERSTOOD_QUERY} control={<Radio />} label="Misunderstood the query" />
                  <FormControlLabel value={ErrorCategory.IRRELEVANT} control={<Radio />} label="Irrelevant to the query" />
                  <FormControlLabel value={ErrorCategory.OTHER} control={<Radio />} label="Other issue" />
                </RadioGroup>
              </FormControl>
            </Box>
          )}
          
          <Box>
            <TextField
              label="Additional Comments"
              multiline
              rows={4}
              fullWidth
              value={feedbackText}
              onChange={handleFeedbackTextChange}
              placeholder="Please provide any additional feedback or details about your experience with this response..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Feedback Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ResponseFeedback;
