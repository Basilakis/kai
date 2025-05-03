/**
 * Multilingual Dictionaries Routes
 * 
 * API routes for managing multilingual property dictionaries.
 */

import express from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';
import { multilingualDictionaryService } from '@kai/shared/src/services/multilingual/multilingualDictionaryService';
import { logger } from '../utils/logger';
import {
  LanguageCodeCreateInputSchema,
  LanguageCodeUpdateInputSchema,
  PropertyNameTranslationCreateInputSchema,
  PropertyNameTranslationUpdateInputSchema,
  PropertyValueTranslationCreateInputSchema,
  PropertyValueTranslationUpdateInputSchema
} from '@kai/shared/src/types/multilingual-dictionaries';

const router = express.Router();

/**
 * @route   GET /api/multilingual/languages
 * @desc    Get all language codes
 * @access  Public
 */
router.get(
  '/languages',
  asyncHandler(async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly !== 'false';
      
      const languages = await multilingualDictionaryService.getLanguageCodes(activeOnly);
      
      res.json({
        success: true,
        languages
      });
    } catch (error) {
      logger.error('Error getting language codes', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/languages/:code
 * @desc    Get a language code by code
 * @access  Public
 */
router.get(
  '/languages/:code',
  asyncHandler(async (req, res) => {
    try {
      const { code } = req.params;
      
      const language = await multilingualDictionaryService.getLanguageCodeByCode(code);
      
      res.json({
        success: true,
        language
      });
    } catch (error) {
      logger.error('Error getting language code', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/languages
 * @desc    Create a new language code
 * @access  Admin
 */
router.post(
  '/languages',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = LanguageCodeCreateInputSchema.parse(req.body);
      
      const language = await multilingualDictionaryService.createLanguageCode(validatedData);
      
      res.status(201).json({
        success: true,
        language
      });
    } catch (error) {
      logger.error('Error creating language code', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/multilingual/languages/:code
 * @desc    Update a language code
 * @access  Admin
 */
router.put(
  '/languages/:code',
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { code } = req.params;
      
      const validatedData = LanguageCodeUpdateInputSchema.parse({
        code,
        ...req.body
      });
      
      const language = await multilingualDictionaryService.updateLanguageCode(validatedData);
      
      res.json({
        success: true,
        language
      });
    } catch (error) {
      logger.error('Error updating language code', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/property-names
 * @desc    Get property name translations
 * @access  Public
 */
router.get(
  '/property-names',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, languageCode } = req.query;
      
      const translations = await multilingualDictionaryService.getPropertyNameTranslations(
        propertyName as string | undefined,
        languageCode as string | undefined
      );
      
      res.json({
        success: true,
        translations
      });
    } catch (error) {
      logger.error('Error getting property name translations', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/property-names/:id
 * @desc    Get a property name translation by ID
 * @access  Public
 */
router.get(
  '/property-names/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const translation = await multilingualDictionaryService.getPropertyNameTranslationById(id);
      
      res.json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error getting property name translation', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/property-names
 * @desc    Create a new property name translation
 * @access  Private
 */
router.post(
  '/property-names',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = PropertyNameTranslationCreateInputSchema.parse(req.body);
      
      const translation = await multilingualDictionaryService.createPropertyNameTranslation(validatedData);
      
      res.status(201).json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error creating property name translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/multilingual/property-names/:id
 * @desc    Update a property name translation
 * @access  Private
 */
router.put(
  '/property-names/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = PropertyNameTranslationUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const translation = await multilingualDictionaryService.updatePropertyNameTranslation(validatedData);
      
      res.json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error updating property name translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/multilingual/property-names/:id
 * @desc    Delete a property name translation
 * @access  Private
 */
router.delete(
  '/property-names/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await multilingualDictionaryService.deletePropertyNameTranslation(id);
      
      res.json({
        success: true,
        message: 'Property name translation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting property name translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/property-values
 * @desc    Get property value translations
 * @access  Public
 */
router.get(
  '/property-values',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, propertyValue, languageCode } = req.query;
      
      const translations = await multilingualDictionaryService.getPropertyValueTranslations(
        propertyName as string | undefined,
        propertyValue as string | undefined,
        languageCode as string | undefined
      );
      
      res.json({
        success: true,
        translations
      });
    } catch (error) {
      logger.error('Error getting property value translations', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/property-values/:id
 * @desc    Get a property value translation by ID
 * @access  Public
 */
router.get(
  '/property-values/:id',
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const translation = await multilingualDictionaryService.getPropertyValueTranslationById(id);
      
      res.json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error getting property value translation', { error });
      res.status(404).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/property-values
 * @desc    Create a new property value translation
 * @access  Private
 */
router.post(
  '/property-values',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const validatedData = PropertyValueTranslationCreateInputSchema.parse(req.body);
      
      const translation = await multilingualDictionaryService.createPropertyValueTranslation(validatedData);
      
      res.status(201).json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error creating property value translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   PUT /api/multilingual/property-values/:id
 * @desc    Update a property value translation
 * @access  Private
 */
router.put(
  '/property-values/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      const validatedData = PropertyValueTranslationUpdateInputSchema.parse({
        id,
        ...req.body
      });
      
      const translation = await multilingualDictionaryService.updatePropertyValueTranslation(validatedData);
      
      res.json({
        success: true,
        translation
      });
    } catch (error) {
      logger.error('Error updating property value translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   DELETE /api/multilingual/property-values/:id
 * @desc    Delete a property value translation
 * @access  Private
 */
router.delete(
  '/property-values/:id',
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { id } = req.params;
      
      await multilingualDictionaryService.deletePropertyValueTranslation(id);
      
      res.json({
        success: true,
        message: 'Property value translation deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting property value translation', { error });
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/properties
 * @desc    Get multilingual properties
 * @access  Public
 */
router.get(
  '/properties',
  asyncHandler(async (req, res) => {
    try {
      const languageCodes = req.query.languages 
        ? (req.query.languages as string).split(',') 
        : ['en'];
      
      const properties = await multilingualDictionaryService.getMultilingualProperties(languageCodes);
      
      res.json({
        success: true,
        properties
      });
    } catch (error) {
      logger.error('Error getting multilingual properties', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   GET /api/multilingual/property-values/:propertyName
 * @desc    Get multilingual property values
 * @access  Public
 */
router.get(
  '/property-values/:propertyName',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName } = req.params;
      const languageCodes = req.query.languages 
        ? (req.query.languages as string).split(',') 
        : ['en'];
      
      const values = await multilingualDictionaryService.getMultilingualPropertyValues(
        propertyName,
        languageCodes
      );
      
      res.json({
        success: true,
        values
      });
    } catch (error) {
      logger.error('Error getting multilingual property values', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/material-properties
 * @desc    Get multilingual material properties
 * @access  Public
 */
router.post(
  '/material-properties',
  asyncHandler(async (req, res) => {
    try {
      const { materialId, properties, languages } = req.body;
      
      if (!materialId || !properties) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: materialId, properties'
        });
      }
      
      const languageCodes = languages || ['en'];
      
      const multilingualProperties = await multilingualDictionaryService.getMultilingualMaterialProperties(
        materialId,
        properties,
        languageCodes
      );
      
      res.json({
        success: true,
        multilingualProperties
      });
    } catch (error) {
      logger.error('Error getting multilingual material properties', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/translate-property-name
 * @desc    Translate a property name
 * @access  Public
 */
router.post(
  '/translate-property-name',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, sourceLanguage, targetLanguage } = req.body;
      
      if (!propertyName || !sourceLanguage || !targetLanguage) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: propertyName, sourceLanguage, targetLanguage'
        });
      }
      
      const translation = await multilingualDictionaryService.translatePropertyName(
        propertyName,
        sourceLanguage,
        targetLanguage
      );
      
      res.json({
        success: true,
        propertyName,
        translation
      });
    } catch (error) {
      logger.error('Error translating property name', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

/**
 * @route   POST /api/multilingual/translate-property-value
 * @desc    Translate a property value
 * @access  Public
 */
router.post(
  '/translate-property-value',
  asyncHandler(async (req, res) => {
    try {
      const { propertyName, propertyValue, sourceLanguage, targetLanguage } = req.body;
      
      if (!propertyName || !propertyValue || !sourceLanguage || !targetLanguage) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: propertyName, propertyValue, sourceLanguage, targetLanguage'
        });
      }
      
      const translation = await multilingualDictionaryService.translatePropertyValue(
        propertyName,
        propertyValue,
        sourceLanguage,
        targetLanguage
      );
      
      res.json({
        success: true,
        propertyName,
        propertyValue,
        translation
      });
    } catch (error) {
      logger.error('Error translating property value', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

export default router;
