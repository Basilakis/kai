import React from 'react';
import { Box, Typography, Paper, Divider } from '@mui/material';
import ResponseFeedback from '../feedback/ResponseFeedback';

// Props interface
interface ResponseMessageProps {
  responseId: string;
  modelId: string;
  query: string;
  response: string;
  timestamp: Date;
  feedbackVariant?: 'thumbs' | 'stars' | 'full';
}

/**
 * Response Message Component
 * 
 * This component displays a model response with feedback collection UI.
 */
const ResponseMessage: React.FC<ResponseMessageProps> = ({
  responseId,
  modelId,
  query,
  response,
  timestamp,
  feedbackVariant = 'thumbs'
}) => {
  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        mb: 2, 
        backgroundColor: 'grey.50',
        borderRadius: 2
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="primary">
          AI Assistant
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTime(timestamp)}
        </Typography>
      </Box>
      
      <Typography variant="body1">
        {response}
      </Typography>
      
      <Divider sx={{ my: 1.5 }} />
      
      <ResponseFeedback
        responseId={responseId}
        modelId={modelId}
        query={query}
        response={response}
        variant={feedbackVariant}
        onFeedbackSubmitted={(feedback) => {
          console.log('Feedback submitted:', feedback);
          // You can add additional handling here if needed
        }}
      />
    </Paper>
  );
};

export default ResponseMessage;
