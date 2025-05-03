import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  Alert,
  Grid,
  IconButton
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Image as ImageIcon
} from '@mui/icons-material';
import { useAuth } from '../../../client/src/hooks/useAuth';

interface VisualReferenceImageUploaderProps {
  referenceId: string;
  onSuccess?: () => void;
}

/**
 * Visual Reference Image Uploader Component
 * 
 * Component for uploading images to a visual reference.
 */
const VisualReferenceImageUploader: React.FC<VisualReferenceImageUploaderProps> = ({
  referenceId,
  onSuccess
}) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [isPrimary, setIsPrimary] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed');
        return;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds 10MB limit');
        return;
      }
      
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setError(null);
    }
  };

  // Handle file upload
  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!caption.trim()) {
      setError('Please enter a caption for the image');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('caption', caption);
      formData.append('isPrimary', isPrimary.toString());
      
      const response = await fetch(`/api/visual-references/${referenceId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Image uploaded successfully');
        setSelectedFile(null);
        setPreview(null);
        setCaption('');
        setIsPrimary(false);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        if (onSuccess) {
          onSuccess();
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setIsPrimary(false);
    setError(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload Images
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 1,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {preview ? (
                <Box
                  component="img"
                  src={preview}
                  alt="Preview"
                  sx={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    mb: 2
                  }}
                />
              ) : (
                <ImageIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
              )}
              
              <Typography variant="body1" gutterBottom>
                {selectedFile ? selectedFile.name : 'Click to select an image'}
              </Typography>
              
              <Typography variant="caption" color="text.secondary">
                Supported formats: JPG, PNG, GIF, WebP (max 10MB)
              </Typography>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                style={{ display: 'none' }}
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <TextField
                label="Caption"
                fullWidth
                required
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={loading || !selectedFile}
                multiline
                rows={3}
                sx={{ mb: 2 }}
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    disabled={loading || !selectedFile}
                  />
                }
                label="Set as primary image"
              />
              
              <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={loading || !selectedFile}
                >
                  Cancel
                </Button>
                
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                  onClick={handleUpload}
                  disabled={loading || !selectedFile || !caption.trim()}
                >
                  Upload
                </Button>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <Typography variant="subtitle1" gutterBottom>
        Tips for Good Visual References
      </Typography>
      
      <Paper sx={{ p: 2 }}>
        <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
          <li>Use high-quality, clear images that clearly demonstrate the property</li>
          <li>Include multiple angles or examples when relevant</li>
          <li>Ensure proper lighting to accurately represent the property</li>
          <li>Include scale references when size or dimension is important</li>
          <li>Add detailed annotations to highlight specific features</li>
          <li>Use consistent image styles for better comparison</li>
        </Typography>
      </Paper>
    </Box>
  );
};

export default VisualReferenceImageUploader;
