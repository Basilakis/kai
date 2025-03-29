const express = require('express');
const multer = require('multer');
import threeDDesignerController from '../controllers/threeDDesigner.controller';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

/**
 * @route POST /api/3d/reconstruct
 * @desc Process an image for 3D reconstruction using HorizonNet + CubeMap
 * @access Private
 */
router.post(
  '/reconstruct',
  upload.single('image'),
  threeDDesignerController.processImage
);

/**
 * @route POST /api/3d/variations
 * @desc Generate scene variations based on reconstructed room
 * @access Private
 */
router.post(
  '/variations',
  threeDDesignerController.generateVariations
);

/**
 * @route POST /api/3d/export
 * @desc Export 3D scene to specified format (gltf/obj/fbx)
 * @access Private
 */
router.post(
  '/export',
  threeDDesignerController.exportScene
);

export default router;