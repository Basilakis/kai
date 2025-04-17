/**
 * Bulk Credit Controller
 * 
 * This controller handles API endpoints for bulk credit purchases,
 * including package management and volume discounts.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import bulkPurchaseService from '../../services/credit/bulkPurchase.service';

/**
 * Get all bulk credit packages
 * @route GET /api/credits/packages
 * @access Public
 */
export const getBulkCreditPackages = async (_req: Request, res: Response) => {
  try {
    const packages = await bulkPurchaseService.getBulkCreditPackages();
    
    res.status(200).json({
      success: true,
      data: packages
    });
  } catch (error) {
    logger.error(`Error getting bulk credit packages: ${error}`);
    throw new ApiError(500, 'Failed to get bulk credit packages');
  }
};

/**
 * Create a bulk credit package
 * @route POST /api/credits/packages
 * @access Admin
 */
export const createBulkCreditPackage = async (req: Request, res: Response) => {
  try {
    const { 
      name, 
      description, 
      creditAmount, 
      price, 
      currency, 
      discountPercentage, 
      stripePriceId, 
      metadata 
    } = req.body;
    
    if (!name) {
      throw new ApiError(400, 'Name is required');
    }
    
    if (!creditAmount || creditAmount <= 0) {
      throw new ApiError(400, 'Credit amount is required and must be positive');
    }
    
    if (!price || price <= 0) {
      throw new ApiError(400, 'Price is required and must be positive');
    }
    
    if (discountPercentage === undefined || discountPercentage < 0 || discountPercentage > 100) {
      throw new ApiError(400, 'Discount percentage is required and must be between 0 and 100');
    }
    
    const pkg = await bulkPurchaseService.createBulkCreditPackage(
      name,
      description,
      creditAmount,
      price,
      currency || 'USD',
      discountPercentage,
      stripePriceId,
      metadata
    );
    
    res.status(201).json({
      success: true,
      message: 'Bulk credit package created successfully',
      data: pkg
    });
  } catch (error) {
    logger.error(`Error creating bulk credit package: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create bulk credit package');
  }
};

/**
 * Update a bulk credit package
 * @route PUT /api/credits/packages/:packageId
 * @access Admin
 */
export const updateBulkCreditPackage = async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const { 
      name, 
      description, 
      creditAmount, 
      price, 
      currency, 
      discountPercentage, 
      stripePriceId, 
      isActive,
      metadata 
    } = req.body;
    
    // Validate input
    if (creditAmount !== undefined && creditAmount <= 0) {
      throw new ApiError(400, 'Credit amount must be positive');
    }
    
    if (price !== undefined && price <= 0) {
      throw new ApiError(400, 'Price must be positive');
    }
    
    if (discountPercentage !== undefined && 
        (discountPercentage < 0 || discountPercentage > 100)) {
      throw new ApiError(400, 'Discount percentage must be between 0 and 100');
    }
    
    // Prepare updates
    const updates: any = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (creditAmount !== undefined) updates.creditAmount = creditAmount;
    if (price !== undefined) updates.price = price;
    if (currency !== undefined) updates.currency = currency;
    if (discountPercentage !== undefined) updates.discountPercentage = discountPercentage;
    if (stripePriceId !== undefined) updates.stripePriceId = stripePriceId;
    if (isActive !== undefined) updates.isActive = isActive;
    if (metadata !== undefined) updates.metadata = metadata;
    
    const pkg = await bulkPurchaseService.updateBulkCreditPackage(packageId, updates);
    
    res.status(200).json({
      success: true,
      message: 'Bulk credit package updated successfully',
      data: pkg
    });
  } catch (error) {
    logger.error(`Error updating bulk credit package: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update bulk credit package');
  }
};

/**
 * Delete a bulk credit package
 * @route DELETE /api/credits/packages/:packageId
 * @access Admin
 */
export const deleteBulkCreditPackage = async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    
    await bulkPurchaseService.deleteBulkCreditPackage(packageId);
    
    res.status(200).json({
      success: true,
      message: 'Bulk credit package deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting bulk credit package: ${error}`);
    throw new ApiError(500, 'Failed to delete bulk credit package');
  }
};

/**
 * Calculate price for a credit amount
 * @route GET /api/credits/calculate-price
 * @access Public
 */
export const calculateCreditPrice = async (req: Request, res: Response) => {
  try {
    const { creditAmount } = req.query;
    
    if (!creditAmount || parseInt(creditAmount as string) <= 0) {
      throw new ApiError(400, 'Credit amount is required and must be positive');
    }
    
    const result = await bulkPurchaseService.calculateCreditPrice(
      parseInt(creditAmount as string)
    );
    
    res.status(200).json({
      success: true,
      data: {
        creditAmount: parseInt(creditAmount as string),
        originalPrice: result.originalPrice,
        discountedPrice: result.discountedPrice,
        discountPercentage: result.discountPercentage,
        savings: result.savings,
        appliedPackage: result.appliedPackage ? {
          id: result.appliedPackage.id,
          name: result.appliedPackage.name,
          description: result.appliedPackage.description
        } : null
      }
    });
  } catch (error) {
    logger.error(`Error calculating credit price: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to calculate credit price');
  }
};

/**
 * Purchase credits
 * @route POST /api/credits/purchase
 * @access Private
 */
export const purchaseCredits = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { creditAmount, paymentMethodId, metadata } = req.body;
    
    if (!creditAmount || creditAmount <= 0) {
      throw new ApiError(400, 'Credit amount is required and must be positive');
    }
    
    if (!paymentMethodId) {
      throw new ApiError(400, 'Payment method ID is required');
    }
    
    const result = await bulkPurchaseService.purchaseCredits(
      userId,
      creditAmount,
      paymentMethodId,
      metadata
    );
    
    res.status(200).json({
      success: true,
      message: `Successfully purchased ${creditAmount} credits`,
      data: result
    });
  } catch (error) {
    logger.error(`Error purchasing credits: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to purchase credits');
  }
};

/**
 * Purchase a credit package
 * @route POST /api/credits/purchase-package
 * @access Private
 */
export const purchaseCreditPackage = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { packageId, paymentMethodId, metadata } = req.body;
    
    if (!packageId) {
      throw new ApiError(400, 'Package ID is required');
    }
    
    if (!paymentMethodId) {
      throw new ApiError(400, 'Payment method ID is required');
    }
    
    const result = await bulkPurchaseService.purchaseCreditPackage(
      userId,
      packageId,
      paymentMethodId,
      metadata
    );
    
    res.status(200).json({
      success: true,
      message: `Successfully purchased credit package with ${result.creditAmount} credits`,
      data: result
    });
  } catch (error) {
    logger.error(`Error purchasing credit package: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to purchase credit package');
  }
};

export default {
  getBulkCreditPackages,
  createBulkCreditPackage,
  updateBulkCreditPackage,
  deleteBulkCreditPackage,
  calculateCreditPrice,
  purchaseCredits,
  purchaseCreditPackage
};
