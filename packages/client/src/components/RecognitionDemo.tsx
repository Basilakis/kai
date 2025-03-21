import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

/**
 * RecognitionDemo component for demonstrating material recognition
 */
const RecognitionDemo: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const file = acceptedFiles[0];
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }
    
    setImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1
  });

  // Handle recognition
  const handleRecognize = async () => {
    if (!image) {
      setError('Please upload an image first');
      return;
    }
    
    setIsRecognizing(true);
    setError(null);
    
    try {
      // In a real implementation, this would call the API
      // For demo purposes, we'll simulate a response after a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock results
      setResults([
        {
          id: '1',
          name: 'Marble Tile - Carrara White',
          manufacturer: 'LuxStone',
          confidence: 0.92,
          image: '/images/demo/marble-tile.jpg',
          specs: {
            material: 'Marble',
            size: '12" x 24"',
            color: 'White',
            finish: 'Polished'
          }
        },
        {
          id: '2',
          name: 'Porcelain Tile - Marble Look',
          manufacturer: 'TileWorks',
          confidence: 0.87,
          image: '/images/demo/porcelain-marble-look.jpg',
          specs: {
            material: 'Porcelain',
            size: '12" x 24"',
            color: 'White/Gray',
            finish: 'Matte'
          }
        },
        {
          id: '3',
          name: 'Ceramic Tile - White Subway',
          manufacturer: 'ClassicTiles',
          confidence: 0.76,
          image: '/images/demo/subway-tile.jpg',
          specs: {
            material: 'Ceramic',
            size: '3" x 6"',
            color: 'White',
            finish: 'Glossy'
          }
        }
      ]);
    } catch (err) {
      setError('An error occurred during recognition. Please try again.');
    } finally {
      setIsRecognizing(false);
    }
  };

  // Reset the demo
  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResults(null);
    setError(null);
  };

  return (
    <section className="recognition-demo">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Try It Yourself</h2>
          <p className="section-subtitle">
            Upload an image of a material and see our recognition system in action
          </p>
        </div>
        
        <div className="recognition-demo-content">
          <div className="upload-section">
            {!preview ? (
              <div 
                {...getRootProps()} 
                className={`dropzone ${isDragActive ? 'active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="dropzone-content">
                  <i className="icon-upload"></i>
                  <p>
                    {isDragActive
                      ? 'Drop the image here'
                      : 'Drag & drop an image here, or click to select'}
                  </p>
                  <span className="dropzone-hint">
                    Supports JPEG, PNG, WebP (max 10MB)
                  </span>
                </div>
              </div>
            ) : (
              <div className="preview-container">
                <img 
                  src={preview} 
                  alt="Preview" 
                  className="image-preview" 
                />
                <div className="preview-actions">
                  <button 
                    className="button secondary" 
                    onClick={handleReset}
                    disabled={isRecognizing}
                  >
                    Reset
                  </button>
                  <button 
                    className="button primary" 
                    onClick={handleRecognize}
                    disabled={isRecognizing}
                  >
                    {isRecognizing ? 'Recognizing...' : 'Recognize Material'}
                  </button>
                </div>
              </div>
            )}
            
            {error && (
              <div className="error-message">
                <i className="icon-error"></i>
                <span>{error}</span>
              </div>
            )}
          </div>
          
          {results && (
            <div className="results-section">
              <h3 className="results-title">Recognition Results</h3>
              <div className="results-list">
                {results.map((result) => (
                  <div className="result-card" key={result.id}>
                    <div className="result-image">
                      <img src={result.image} alt={result.name} />
                      <span className="confidence-badge">
                        {Math.round(result.confidence * 100)}% Match
                      </span>
                    </div>
                    <div className="result-details">
                      <h4 className="result-name">{result.name}</h4>
                      <p className="result-manufacturer">{result.manufacturer}</p>
                      <div className="result-specs">
                        <div className="spec-item">
                          <span className="spec-label">Material:</span>
                          <span className="spec-value">{result.specs.material}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Size:</span>
                          <span className="spec-value">{result.specs.size}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Color:</span>
                          <span className="spec-value">{result.specs.color}</span>
                        </div>
                        <div className="spec-item">
                          <span className="spec-label">Finish:</span>
                          <span className="spec-value">{result.specs.finish}</span>
                        </div>
                      </div>
                      <button className="button secondary small">View Details</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default RecognitionDemo;