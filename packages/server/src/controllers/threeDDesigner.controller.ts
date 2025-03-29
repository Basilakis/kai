interface BaseRequest {
  body: any;
  query: any;
  params: any;
}

interface RequestWithFile extends BaseRequest {
  file?: { buffer: Buffer };
}

interface Response {
  status: (code: number) => Response;
  json: (data: any) => void;
}
import threeDService from '../services/3d-designer/threeDService';

export class ThreeDDesignerController {
  /**
   * Process an image for 3D reconstruction
   */
  async processImage(req: RequestWithFile, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image file provided'
        });
      }

      const options = {
        extractLayout: req.body.extractLayout !== 'false',
        detectObjects: req.body.detectObjects !== 'false',
        estimateDepth: req.body.estimateDepth !== 'false',
        segmentScene: req.body.segmentScene !== 'false'
      };

      const result = await threeDService.processImage(req.file.buffer, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error processing image:', error);
      res.status(500).json({
        error: 'Failed to process image'
      });
    }
  }


  /**
   * Generate scene variations
   */
  async generateVariations(req: BaseRequest, res: Response) {
    try {
      const { sceneData, options } = req.body;

      if (!sceneData) {
        return res.status(400).json({
          error: 'Scene data is required'
        });
      }

      const variations = await threeDService.generateVariations(sceneData, options);

      res.json({
        success: true,
        data: variations
      });
    } catch (error) {
      console.error('Error generating variations:', error);
      res.status(500).json({
        error: 'Failed to generate scene variations'
      });
    }
  }

  /**
   * Export scene to specified format
   */
  async exportScene(req: BaseRequest, res: Response) {
    try {
      const { sceneData, format } = req.body;

      if (!sceneData) {
        return res.status(400).json({
          error: 'Scene data is required'
        });
      }

      const exportedScene = await threeDService.exportScene(
        sceneData,
        format as 'gltf' | 'obj' | 'fbx'
      );

      if (!exportedScene) {
        return res.status(400).json({
          error: 'Failed to export scene'
        });
      }

      res.json({
        success: true,
        data: exportedScene
      });
    } catch (error) {
      console.error('Error exporting scene:', error);
      res.status(500).json({
        error: 'Failed to export scene'
      });
    }
  }
}

export default new ThreeDDesignerController();