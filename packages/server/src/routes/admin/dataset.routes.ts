/**
 * Admin Dataset Routes
 *
 * Defines API endpoints for administrative actions on datasets.
 */
import express, { Router } from 'express'; // Import express
import { datasetAdminController } from '../../controllers/admin/dataset.controller';
// Correct middleware imports
import { authMiddleware, authorize } from '../../middleware/auth.middleware'; 
import { asyncHandler } from '../../middleware/error.middleware'; // Import from correct location
import { NetworkAccessType } from '../../utils/network'; // Import NetworkAccessType

const router = express.Router(); // Use express.Router()

// Middleware: Ensure user is authenticated and is an admin for all routes in this file
router.use(authMiddleware); // Use correct middleware name
router.use(authorize({ 
  roles: ['admin'],
  accessType: NetworkAccessType.INTERNAL_ONLY // Restrict to internal networks only
}));

/**
 * @swagger
 * /admin/datasets/{id}/split:
 *   post:
 *     summary: Split a dataset into train/validation/test sets
 *     tags: [Admin - Datasets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the dataset to split
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               splitRatios:
 *                 type: object
 *                 properties:
 *                   train:
 *                     type: number
 *                     description: Percentage for training set (e.g., 70)
 *                   validation:
 *                     type: number
 *                     description: Percentage for validation set (e.g., 20)
 *                   test:
 *                     type: number
 *                     description: Percentage for test set (e.g., 10)
 *                 required: [train, validation, test]
 *               stratified:
 *                 type: boolean
 *                 description: Whether to perform stratified splitting (default: true)
 *             required: [splitRatios]
 *     responses:
 *       200:
 *         description: Dataset split successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 splitInfo:
 *                   type: object
 *                   properties:
 *                     trainSetId:
 *                       type: string
 *                     validationSetId:
 *                       type: string
 *                     testSetId:
 *                       type: string
 *       400:
 *         description: Bad request (e.g., invalid ratios)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (User is not an admin)
 *       404:
 *         description: Dataset not found
 *       500:
 *         description: Internal server error
 */
// Pass controller methods directly to asyncHandler
router.post('/:id/split', asyncHandler(datasetAdminController.splitDataset)); 

/**
 * @swagger
 * /admin/datasets/{id}/train:
 *   post:
 *     summary: Start a training job for a dataset
 *     tags: [Admin - Datasets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the dataset to train on
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 $ref: '#/components/schemas/TrainingConfiguration' # Reference the TrainingConfiguration schema (needs to be defined in swagger config)
 *             required: [config]
 *     responses:
 *       202:
 *         description: Training job submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *       400:
 *         description: Bad request (e.g., missing config)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (User is not an admin)
 *       404:
 *         description: Dataset not found or not ready
 *       500:
 *         description: Internal server error
 */
// Pass controller methods directly to asyncHandler
router.post('/:id/train', asyncHandler(datasetAdminController.startTrainingJob));

export default router;