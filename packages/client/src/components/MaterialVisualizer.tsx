import React, { useEffect, useRef, useState } from 'react';
import { Material } from '@kai/shared/types/material';
import { MaterialVisualizationProvider } from '@kai/shared/services/3d/materialVisualizationProvider';

/**
 * This new version calls the provider’s methods rather than duplicating
 * three.js and AR logic. All scene/AR logic is shifted to the provider.
 */

export interface MaterialVisualizerProps {
  material: Material;
  quality?: 'low' | 'medium' | 'high';
  enableAR?: boolean;
  onError?: (error: Error) => void;
}

export const MaterialVisualizer: React.FC<MaterialVisualizerProps> = ({
  material,
  quality = 'medium',
  enableAR = false,
  onError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [modelUrl, setModelUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Provide the user an instance of the shared provider
        const provider = new MaterialVisualizationProvider({
          // We might pass real endpoints or a fallback
          nerfStudio: '',
          instantNgp: '',
          blenderProc: '',
          shapE: '',
          get3d: 'http://localhost:7020',
          hunyuan3d: '',
          yolo: '',
          sam: '',
          midas: '',
          architecturalRecognition: '',
          roomLayoutGenerator: '',
          controlNet: '',
          text2material: '',
          clip: ''
        });

        // Generate high-level visualization
        const url = await provider.generateVisualization(material, {
          quality,
          enableAR
        });
        setModelUrl(url);

        // If we wanted to unify scene logic, we’d call:
        if (containerRef.current) {
          provider.setupThreeJsScene(containerRef.current);
        }

        // Initialize AR if enabled
        if (enableAR && containerRef.current) {
          await provider.initializeAR(material, { quality, enableAR: true });
          // Or if we want to do advanced AR scene logic:
          // await provider.initializeARSession(containerRef.current, material, { quality, enableAR:true });
        }

        setIsLoading(false);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to initialize visualization');
        setError(e);
        onError?.(e);
        setIsLoading(false);
      }
    })();
  }, [material, quality, enableAR, onError]);

  if (isLoading) {
    return (
      <div className="material-visualizer-loading">
        <div className="spinner"></div>
        <p>Loading material visualization...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="material-visualizer-error">
        <p>Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="material-visualizer" ref={containerRef}>
      {modelUrl ? (
        <p>Visualization generated at URL: {modelUrl}</p>
      ) : (
        <p>No model URL available.</p>
      )}
    </div>
  );
};

export default MaterialVisualizer;