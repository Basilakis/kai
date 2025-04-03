import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter, GLTFExporterOptions } from 'three/examples/jsm/exporters/GLTFExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { FBXExporter } from 'three/examples/jsm/exporters/FBXExporter';
import { computeBoundsTree } from 'three-mesh-bvh';

type SceneControllerProps = {
  scene: THREE.Scene;
  onSceneUpdate?: (scene: THREE.Scene) => void;
  enableRealTimePreview?: boolean;
  previewInterval?: number;
  children?: React.ReactNode;
};

export interface SceneModification {
  type: 'position' | 'rotation' | 'scale' | 'material' | 'geometry';
  objectId: string;
  value: any;
}

export interface ExportOptions {
  format: 'glb' | 'fbx' | 'obj';
  preserveMetadata?: boolean;
  embedTextures?: boolean;
  quality?: number;
}

const SceneController = ({
  scene,
  onSceneUpdate,
  enableRealTimePreview = true,
  previewInterval = 100,
  children,
}: SceneControllerProps) => {
  const [selectedObject, setSelectedObject] = React.useState<THREE.Object3D | null>(null);
  const previewTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  const modificationQueueRef = React.useRef<SceneModification[]>([]);
  const isProcessingRef = React.useRef(false);

  // Process scene modifications in batches for better performance
  const processModificationQueue = React.useCallback(async () => {
    if (isProcessingRef.current || modificationQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    const modifications = [...modificationQueueRef.current];
    modificationQueueRef.current = [];

    try {
      for (const mod of modifications) {
        const object = scene.getObjectByProperty('uuid', mod.objectId) as THREE.Mesh;
        if (!object) continue;

        switch (mod.type) {
          case 'position':
            object.position.set(mod.value.x, mod.value.y, mod.value.z);
            break;
          case 'rotation':
            object.rotation.set(mod.value.x, mod.value.y, mod.value.z);
            break;
          case 'scale':
            object.scale.set(mod.value.x, mod.value.y, mod.value.z);
            break;
          case 'material':
            if (object instanceof THREE.Mesh) {
              if (object.material instanceof THREE.Material) {
                object.material.dispose();
              }
              object.material = mod.value;
            }
            break;
          case 'geometry':
            if (object instanceof THREE.Mesh) {
              object.geometry.dispose();
              object.geometry = mod.value;
              // Recompute BVH if needed
              if ((object as any).geometry.computeBoundsTree) {
                (object as any).geometry.computeBoundsTree();
              }
            }
            break;
        }
      }

      // Notify parent of scene updates
      if (onSceneUpdate) {
        onSceneUpdate(scene);
      }
    } finally {
      isProcessingRef.current = false;
    }
  }, [scene, onSceneUpdate]);

  // Set up real-time preview
  React.useEffect(() => {
    if (!enableRealTimePreview) return;

    const processPreview = () => {
      processModificationQueue();
      previewTimeoutRef.current = setTimeout(processPreview, previewInterval);
    };

    processPreview();

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [enableRealTimePreview, previewInterval, processModificationQueue]);

  // Scene modification methods
  const modifyScene = React.useCallback((modification: SceneModification) => {
    modificationQueueRef.current.push(modification);
    if (!enableRealTimePreview) {
      processModificationQueue();
    }
  }, [enableRealTimePreview, processModificationQueue]);

  // Export scene to different formats
  const exportScene = React.useCallback(async (options: ExportOptions): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        switch (options.format) {
          case 'glb': {
            const exporter = new GLTFExporter();
            const exportOptions = {
              binary: true,
              embedImages: options.embedTextures ?? false,
              maxTextureSize: options.quality ? options.quality * 1024 : 1024,
            };
            exporter.parse(scene, (buffer: ArrayBuffer) => {
              resolve(new Blob([buffer as ArrayBuffer], { type: 'model/gltf-binary' }));
            }, exportOptions);
            break;
          }
          case 'obj': {
            const exporter = new OBJExporter();
            const result = exporter.parse(scene);
            resolve(new Blob([result], { type: 'model/obj' }));
            break;
          }
          case 'fbx': {
            const exporter = new FBXExporter();
            const result = exporter.parse(scene);
            resolve(new Blob([result], { type: 'model/fbx' }));
            break;
          }
          default:
            reject(new Error('Unsupported export format'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }, [scene]);

  // Optimize scene with BVH
  const optimizeSceneBVH = React.useCallback(() => {
    scene.traverse((object: THREE.Object3D) => {
      if (object instanceof THREE.Mesh) {
        if (!object.geometry.boundsTree) {
          object.geometry.computeBoundsTree = computeBoundsTree;
          object.geometry.computeBoundsTree();
        }
      }
    });
  }, [scene]);

  // Select object in scene
  const selectObject = React.useCallback((objectId: string) => {
    const object = scene.getObjectByProperty('uuid', objectId);
    setSelectedObject(object ?? null);
  }, [scene]);

  return (
    <div className="scene-controller">
      {/* Expose methods via React Context or props */}
      {children && (children as React.ReactElement[]).map((child) => (
        <child.type
          {...child.props}
          key={child.key}
          onModifyScene={modifyScene}
          onExportScene={exportScene}
          onOptimizeScene={optimizeSceneBVH}
          onSelectObject={selectObject}
          selectedObject={selectedObject}
        />
      ))}
    </div>
  );
};

export default SceneController;