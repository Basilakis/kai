import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import creditMiddleware from '../middleware/credit.middleware';
import asyncHandler from 'express-async-handler';
import { runMlScript } from '../utils/mlScriptRunner'; // Import the utility
import { withTempDir } from '../utils/tempFileManager'; // Import the temp dir utility
import { logger } from '../utils/logger'; // Import logger

// Configure multer for file uploads (destination handled by route logic now)
// Using memoryStorage temporarily, or define a base upload dir if needed
// const storage = multer.memoryStorage(); // Option 1: Use memory storage
const baseUploadDir = path.join(os.tmpdir(), 'scene-graph-uploads-base');
fs.mkdirSync(baseUploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    // We still need a destination for multer, even if we move files later
    cb(null, baseUploadDir);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});


const upload = multer({ storage });

const router = express.Router();

// Type for representing files with paths
interface MulterFile extends Express.Multer.File {
  path: string;
}

// Define expected result types
interface SceneGraphResult {
  nodes?: any[];
  edges?: any[];
  error?: string;
}

interface QueryResult {
  results?: any;
  error?: string;
}

interface SuggestionResult {
  suggestions?: any[];
  error?: string;
}

/**
 * @swagger
 * /api/scene-graph/health:
 *   get:
 *     summary: Check scene graph service health
 *     description: Verify that the scene graph service is operational
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unavailable
 */
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await runMlScript<string>({
        scriptPath: 'packages.ml.python.scene_graph_service',
        args: ['--mode', 'health']
    });
    res.status(200).json({ status: 'healthy', details: result });
  } catch (error) {
     logger.error('Scene graph service health check failed', { error });
     throw new ApiError(503, 'Scene graph service unavailable', true);
  }
}));

/**
 * @swagger
 * /api/scene-graph/generate-from-model:
 *   post:
 *     summary: Generate a scene graph from a 3D model
 *     description: Upload a 3D model and generate a scene graph with object relationships
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - model
 *             properties:
 *               model:
 *                 type: string
 *                 format: binary
 *               format:
 *                 type: string
 *                 enum: [gltf, obj, fbx]
 *               min_confidence:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 1
 *               max_relationships:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Scene graph generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/generate-from-model',
  authMiddleware,
  creditMiddleware.checkCredits,
  upload.single('model'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, 'No model file provided');
    }
    const modelFile = req.file as MulterFile;
    let originalPath = modelFile.path; // Path where multer saved it

    // Use withTempDir to manage the lifecycle of the potentially moved file
    await withTempDir(async (_tempDirPath) => {
        // Optionally move the file to the managed temp dir if needed by the script
        // For simplicity, if runMlScript can handle the original path, we might not need to move it.
        // Assuming runMlScript needs the file path:
        let inputPath = originalPath;

        // If the script MUST run from a specific temp dir structure, move the file:
        // const newPath = path.join(tempDirPath, modelFile.filename);
        // fs.renameSync(originalPath, newPath);
        // inputPath = newPath;
        // originalPath = null; // Prevent double deletion in finally

        try {
            const format = req.body.format || path.extname(modelFile.originalname).substring(1) || 'gltf';
            const minConfidence = req.body.min_confidence ? parseFloat(req.body.min_confidence) : 0.5;
            const maxRelationships = req.body.max_relationships ? parseInt(req.body.max_relationships) : 100;

            const scriptArgs = [
                '--mode', 'model',
                '--input', inputPath, // Use the potentially moved path
                '--format', format,
                '--min-confidence', minConfidence.toString(),
                '--max-relationships', maxRelationships.toString()
            ];

            const sceneGraph = await runMlScript<SceneGraphResult>({
                scriptPath: 'packages.ml.python.scene_graph_service',
                args: scriptArgs
            });

            // Deduct credits for the operation
            await creditMiddleware.deductCredits('SceneGraphGeneration')(req, res, () => {});
            res.status(200).json(sceneGraph);

        } finally {
             // Clean up the original uploaded file if it wasn't moved/deleted by withTempDir
             if (originalPath && fs.existsSync(originalPath)) {
                 try {
                     fs.unlinkSync(originalPath);
                 } catch (err) {
                     logger.error(`Failed to delete original multer file ${originalPath}:`, err);
                 }
             }
             // The tempDirPath itself will be cleaned up by withTempDir's finally block
        }
    });
  })
);

/**
 * @swagger
 * /api/scene-graph/generate-from-point-cloud:
 *   post:
 *     summary: Generate a scene graph from a point cloud
 *     description: Upload a point cloud file and generate a scene graph with object relationships
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - point_cloud
 *             properties:
 *               point_cloud:
 *                 type: string
 *                 format: binary
 *               min_confidence:
 *                 type: number
 *               max_relationships:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Scene graph generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/generate-from-point-cloud',
  authMiddleware,
  creditMiddleware.checkCredits,
  upload.single('point_cloud'),
  asyncHandler(async (req: Request, res: Response) => {
     if (!req.file) {
        throw new ApiError(400, 'No point cloud file provided');
      }
      const pointCloudFile = req.file as MulterFile;
      let originalPath = pointCloudFile.path;

      await withTempDir(async (_tempDirPath) => {
          // Assuming runMlScript can use the original path
          let inputPath = originalPath;

          try {
            const minConfidence = req.body.min_confidence ? parseFloat(req.body.min_confidence) : 0.5;
            const maxRelationships = req.body.max_relationships ? parseInt(req.body.max_relationships) : 100;

            const scriptArgs = [
              '--mode', 'point-cloud',
              '--input', inputPath,
              '--min-confidence', minConfidence.toString(),
              '--max-relationships', maxRelationships.toString()
            ];

            const sceneGraph = await runMlScript<SceneGraphResult>({
              scriptPath: 'packages.ml.python.scene_graph_service',
              args: scriptArgs
            });

            // Deduct credits for the operation
            await creditMiddleware.deductCredits('SceneGraphGeneration')(req, res, () => {});
            res.status(200).json(sceneGraph);

          } finally {
             // Clean up the original uploaded file
             if (originalPath && fs.existsSync(originalPath)) {
                 try {
                     fs.unlinkSync(originalPath);
                 } catch (err) {
                     logger.error(`Failed to delete original multer file ${originalPath}:`, err);
                 }
             }
             // tempDirPath cleaned by withTempDir
          }
      });
  })
);

/**
 * @swagger
 * /api/scene-graph/generate-from-images:
 *   post:
 *     summary: Generate a scene graph from multiple images
 *     description: Upload multiple images and generate a scene graph with object relationships
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - images
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               camera_params:
 *                 type: string
 *               min_confidence:
 *                 type: number
 *               max_relationships:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Scene graph generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/generate-from-images',
  authMiddleware,
  creditMiddleware.checkCredits,
  upload.array('images', 20),  // Allow up to 20 images
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      throw new ApiError(400, 'No image files provided');
    }

    const imageFiles = req.files as MulterFile[];
    const originalImagePaths = imageFiles.map(f => f.path); // Keep track for cleanup
    let paramsPath: string | null = null; // Keep track for cleanup within withTempDir

    await withTempDir(async (tempDirPath) => {
        // Assuming runMlScript needs image paths and potentially a params file path
        const inputImagePaths = originalImagePaths; // Use original paths if possible

        try {
            const cameraParams = req.body.camera_params;
            const minConfidence = req.body.min_confidence ? parseFloat(req.body.min_confidence) : 0.5;
            const maxRelationships = req.body.max_relationships ? parseInt(req.body.max_relationships) : 100;

            // Prepare arguments
            const args = [
                '--mode', 'images',
                '--output-dir', tempDirPath, // Pass the managed temp dir
                '--min-confidence', minConfidence.toString(),
                '--max-relationships', maxRelationships.toString()
            ];

            // Add image paths
            for (const imgPath of inputImagePaths) {
                args.push('--image');
                args.push(imgPath);
            }

            // Add camera parameters if provided (write to managed temp dir)
            if (cameraParams) {
                paramsPath = path.join(tempDirPath, 'camera_params.json');
                fs.writeFileSync(paramsPath, cameraParams);
                args.push('--camera-params');
                args.push(paramsPath);
                // paramsPath will be cleaned up when tempDirPath is removed
            }

            const sceneGraph = await runMlScript<SceneGraphResult>({
                scriptPath: 'packages.ml.python.scene_graph_service',
                args: args
            });

            // Deduct credits for the operation
            await creditMiddleware.deductCredits('SceneGraphGeneration')(req, res, () => {});
            res.status(200).json(sceneGraph);

        } finally {
            // Clean up the original uploaded image files
            for (const imgPath of originalImagePaths) {
                if (imgPath && fs.existsSync(imgPath)) {
                    try {
                        fs.unlinkSync(imgPath);
                    } catch (err) {
                        logger.error(`Failed to delete original image file ${imgPath}:`, err);
                    }
                }
            }
            // paramsPath (if created) is inside tempDirPath and will be cleaned by withTempDir
            // tempDirPath itself is cleaned by withTempDir
        }
    });
  })
);

/**
 * @swagger
 * /api/scene-graph/query:
 *   post:
 *     summary: Query a scene graph
 *     description: Query a scene graph for specific relationships or objects
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scene_graph
 *               - query
 *             properties:
 *               scene_graph:
 *                 type: object
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Query executed successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/query',
  authMiddleware,
  express.json(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.body.scene_graph) {
      throw new ApiError(400, 'No scene graph provided');
    }
    if (!req.body.query) {
      throw new ApiError(400, 'No query provided');
    }

    await withTempDir(async (tempDirPath) => {
        const sceneGraphPath = path.join(tempDirPath, 'scene_graph.json');
        const queryPath = path.join(tempDirPath, 'query.txt');

        fs.writeFileSync(sceneGraphPath, JSON.stringify(req.body.scene_graph));
        fs.writeFileSync(queryPath, req.body.query);

        const scriptArgs = [
            '--mode', 'query',
            '--scene-graph', sceneGraphPath,
            '--query', queryPath
        ];

        const queryResults = await runMlScript<QueryResult>({
            scriptPath: 'packages.ml.python.scene_graph_service',
            args: scriptArgs
        });

        res.status(200).json({ results: queryResults });
        // tempDirPath and its contents (sceneGraphPath, queryPath) cleaned by withTempDir
    });
  })
);

/**
 * @swagger
 * /api/scene-graph/generate-suggestions:
 *   post:
 *     summary: Generate editing suggestions based on scene graph
 *     description: Analyze a scene graph and generate suggestions for improvement
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scene_graph
 *             properties:
 *               scene_graph:
 *                 type: object
 *     responses:
 *       200:
 *         description: Suggestions generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/generate-suggestions',
  authMiddleware,
  express.json(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.body.scene_graph) {
      throw new ApiError(400, 'No scene graph provided');
    }

    await withTempDir(async (tempDirPath) => {
        const sceneGraphPath = path.join(tempDirPath, 'scene_graph.json');
        fs.writeFileSync(sceneGraphPath, JSON.stringify(req.body.scene_graph));

        const scriptArgs = [
            '--mode', 'suggestions',
            '--scene-graph', sceneGraphPath
        ];

        const suggestions = await runMlScript<SuggestionResult>({
            scriptPath: 'packages.ml.python.scene_graph_service',
            args: scriptArgs
        });

        res.status(200).json({ suggestions });
        // tempDirPath and its contents (sceneGraphPath) cleaned by withTempDir
    });
  })
);

/**
 * @swagger
 * /api/scene-graph/generate-from-text:
 *   post:
 *     summary: Generate a scene graph from text description
 *     description: Create a scene graph based on a textual description
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *               style:
 *                 type: string
 *               constraints:
 *                 type: object
 *     responses:
 *       200:
 *         description: Scene graph generated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/generate-from-text',
  authMiddleware,
  creditMiddleware.checkCredits,
  express.json(),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.body.text) {
      throw new ApiError(400, 'No text description provided');
    }

    await withTempDir(async (tempDirPath) => {
        const textDescription = req.body.text;
        const style = req.body.style || 'default';
        const constraints = req.body.constraints ? JSON.stringify(req.body.constraints) : '{}';

        const textPath = path.join(tempDirPath, 'description.txt');
        fs.writeFileSync(textPath, textDescription);

        const constraintsPath = path.join(tempDirPath, 'constraints.json');
        fs.writeFileSync(constraintsPath, constraints);

        const scriptArgs = [
            '--mode', 'text',
            '--input', textPath,
            '--style', style,
            '--constraints', constraintsPath
        ];

        const sceneGraph = await runMlScript<SceneGraphResult>({
            scriptPath: 'packages.ml.python.scene_graph_service',
            args: scriptArgs
        });

        // Deduct credits for the operation
        await creditMiddleware.deductCredits('SceneGraphGeneration')(req, res, () => {});
        res.status(200).json(sceneGraph);
        // tempDirPath and its contents (textPath, constraintsPath) cleaned by withTempDir
    });
  })
);

export default router;