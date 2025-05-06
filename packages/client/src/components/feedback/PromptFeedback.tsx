import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Rating,
  TextField,
  Chip,
  Stack,
  Collapse,
  IconButton,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Close as CloseIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { promptService } from '../../services/promptService';

// Feedback categories
const FEEDBACK_CATEGORIES = [
  'Accuracy',
  'Relevance',
  'Clarity',
  'Completeness',
  'Helpfulness'
];

// Feedback tags
const FEEDBACK_TAGS = [
  'Missing Information',
  'Incorrect Information',
  'Well Explained',
  'Too Technical',
  'Too Basic',
  'Confusing',
  'Helpful',
  'Not Helpful'
];

interface PromptFeedbackProps {
  trackingId: string;
  onFeedbackSubmitted?: (isSuccessful: boolean) => void;
  compact?: boolean;
  className?: string;
}

/**
 * Prompt feedback component
 * 
 * Allows users to provide feedback on prompt responses
 */
const PromptFeedback: React.FC<PromptFeedbackProps> = ({
  trackingId,
  onFeedbackSubmitted,
  compact = false,
  className
}) => {
  // State
  const [expanded, setExpanded] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Handle thumbs up/down click
  const handleThumbClick = (success: boolean) => {
    setIsSuccessful(success);
    setExpanded(true);
    
    // If compact mode, submit immediately
    if (compact) {
      handleSubmit(success);
    }
  };
  
  // Handle category selection
  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
  };
  
  // Handle tag selection
  const handleTagClick = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };
  
  // Handle feedback submission
  const handleSubmit = async (quickSubmit: boolean = false) => {
    try {
      setSubmitting(true);
      setError(null);
      
      // If quick submit, just use the isSuccessful value
      // Otherwise, use the form values
      const success = await promptService.submitFeedback(
        trackingId,
        quickSubmit ? isSuccessful! : isSuccessful!,
        quickSubmit ? undefined : feedback,
        quickSubmit ? undefined : rating,
        quickSubmit ? undefined : selectedCategory || undefined,
        quickSubmit ? undefined : selectedTags.length > 0 ? selectedTags : undefined
      );
      
      if (success) {
        setSubmitted(true);
        if (onFeedbackSubmitted) {
          onFeedbackSubmitted(isSuccessful!);
        }
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      setError(`Error submitting feedback: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  // Render compact version
  if (compact) {
    return (
      <Box className={className} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {submitted ? (
          <Typography variant="body2" color="text.secondary">
            Thank you for your feedback!
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Was this helpful?
            </Typography>
            <IconButton
              size="small"
              color={isSuccessful === true ? 'success' : 'default'}
              onClick={() => handleThumbClick(true)}
              disabled={submitting}
            >
              <ThumbUpIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color={isSuccessful === false ? 'error' : 'default'}
              onClick={() => handleThumbClick(false)}
              disabled={submitting}
            >
              <ThumbDownIcon fontSize="small" />
            </IconButton>
            {submitting && <CircularProgress size={16} />}
          </>
        )}
      </Box>
    );
  }
  
  // Render full version
  return (
    <Box className={className} sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <IconButton size="small" onClick={() => setError(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}
      
      {submitted ? (
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="h6" color="success.main" gutterBottom>
            Thank you for your feedback!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your feedback helps us improve our responses.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Was this response helpful?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={isSuccessful === true ? 'contained' : 'outlined'}
                color="success"
                startIcon={<ThumbUpIcon />}
                onClick={() => handleThumbClick(true)}
                disabled={submitting}
              >
                Yes
              </Button>
              <Button
                variant={isSuccessful === false ? 'contained' : 'outlined'}
                color="error"
                startIcon={<ThumbDownIcon />}
                onClick={() => handleThumbClick(false)}
                disabled={submitting}
              >
                No
              </Button>
            </Box>
          </Box>
          
          <Collapse in={expanded}>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Rate the quality (optional)
              </Typography>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue)}
                disabled={submitting}
              />
              
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Select a category (optional)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {FEEDBACK_CATEGORIES.map(category => (
                  <Chip
                    key={category}
                    label={category}
                    onClick={() => handleCategoryClick(category)}
                    color={selectedCategory === category ? 'primary' : 'default'}
                    disabled={submitting}
                  />
                ))}
              </Stack>
              
              <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                Select tags (optional)
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {FEEDBACK_TAGS.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onClick={() => handleTagClick(tag)}
                    color={selectedTags.includes(tag) ? 'primary' : 'default'}
                    disabled={submitting}
                  />
                ))}
              </Stack>
              
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Additional feedback (optional)"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                sx={{ mt: 2 }}
                disabled={submitting}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  endIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                  onClick={() => handleSubmit()}
                  disabled={isSuccessful === null || submitting}
                >
                  Submit Feedback
                </Button>
              </Box>
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

export default PromptFeedback;
