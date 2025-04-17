/**
 * Bulk Credit Purchase Service
 * 
 * This service provides functionality for purchasing credits in bulk,
 * including volume discounts and package management.
 */

import { logger } from '../../utils/logger';
import bulkCreditModel, { BulkCreditPackage } from '../../models/bulkCredit.model';
import { addCredits } from '../../models/userCredit.model';
import stripeService from '../payment/stripeService';

/**
 * Base unit price per credit
 */
const BASE_CREDIT_UNIT_PRICE = 0.01; // $0.01 per credit

/**
 * Purchase result
 */
export interface PurchaseResult {
  userId: string;
  creditAmount: number;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  savings: number;
  paymentId?: string;
  transactionId: string;
}

/**
 * Get all bulk credit packages
 * @param includeInactive Whether to include inactive packages
 * @returns Array of bulk credit packages
 */
export async function getBulkCreditPackages(includeInactive: boolean = false): Promise<BulkCreditPackage[]> {
  try {
    return await bulkCreditModel.getAllBulkCreditPackages(includeInactive);
  } catch (error) {
    logger.error(`Failed to get bulk credit packages: ${error}`);
    throw error;
  }
}

/**
 * Create a bulk credit package
 * @param name Package name
 * @param description Package description
 * @param creditAmount Credit amount
 * @param price Package price
 * @param currency Currency
 * @param discountPercentage Discount percentage
 * @param stripePriceId Stripe price ID
 * @param metadata Additional metadata
 * @returns Created bulk credit package
 */
export async function createBulkCreditPackage(
  name: string,
  description: string,
  creditAmount: number,
  price: number,
  currency: string = 'USD',
  discountPercentage: number,
  stripePriceId?: string,
  metadata?: Record<string, any>
): Promise<BulkCreditPackage> {
  try {
    // Validate input
    if (!name) {
      throw new Error('Name is required');
    }
    
    if (creditAmount <= 0) {
      throw new Error('Credit amount must be positive');
    }
    
    if (price <= 0) {
      throw new Error('Price must be positive');
    }
    
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    
    // Create the package
    const pkg = await bulkCreditModel.createBulkCreditPackage({
      name,
      description,
      creditAmount,
      price,
      currency,
      discountPercentage,
      stripePriceId,
      isActive: true,
      metadata
    });
    
    return pkg;
  } catch (error) {
    logger.error(`Failed to create bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Update a bulk credit package
 * @param id Package ID
 * @param updates Updates to apply
 * @returns Updated bulk credit package
 */
export async function updateBulkCreditPackage(
  id: string,
  updates: Partial<BulkCreditPackage>
): Promise<BulkCreditPackage> {
  try {
    // Validate input
    if (updates.creditAmount !== undefined && updates.creditAmount <= 0) {
      throw new Error('Credit amount must be positive');
    }
    
    if (updates.price !== undefined && updates.price <= 0) {
      throw new Error('Price must be positive');
    }
    
    if (updates.discountPercentage !== undefined && 
        (updates.discountPercentage < 0 || updates.discountPercentage > 100)) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    
    // Update the package
    const pkg = await bulkCreditModel.updateBulkCreditPackage(id, updates);
    
    return pkg;
  } catch (error) {
    logger.error(`Failed to update bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Delete a bulk credit package
 * @param id Package ID
 * @returns Whether the package was deleted
 */
export async function deleteBulkCreditPackage(id: string): Promise<boolean> {
  try {
    return await bulkCreditModel.deleteBulkCreditPackage(id);
  } catch (error) {
    logger.error(`Failed to delete bulk credit package: ${error}`);
    throw error;
  }
}

/**
 * Calculate the price for a credit amount
 * @param creditAmount Credit amount
 * @returns Calculated price
 */
export async function calculateCreditPrice(creditAmount: number): Promise<{
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  savings: number;
  appliedPackage: BulkCreditPackage | null;
}> {
  try {
    return await bulkCreditModel.calculateCreditPrice(creditAmount, BASE_CREDIT_UNIT_PRICE);
  } catch (error) {
    logger.error(`Failed to calculate credit price: ${error}`);
    throw error;
  }
}

/**
 * Purchase credits
 * @param userId User ID
 * @param creditAmount Credit amount
 * @param paymentMethodId Payment method ID
 * @param metadata Additional metadata
 * @returns Purchase result
 */
export async function purchaseCredits(
  userId: string,
  creditAmount: number,
  paymentMethodId: string,
  metadata?: Record<string, any>
): Promise<PurchaseResult> {
  try {
    // Calculate price
    const priceResult = await calculateCreditPrice(creditAmount);
    
    // Create Stripe customer if not exists
    const customer = await stripeService.getOrCreateCustomer(userId);
    
    if (!customer) {
      throw new Error('Failed to create Stripe customer');
    }
    
    // Process payment
    const paymentResult = await stripeService.createPayment(
      customer.id,
      Math.round(priceResult.discountedPrice * 100), // Convert to cents
      'USD',
      paymentMethodId,
      `Purchase of ${creditAmount} credits`,
      {
        userId,
        creditAmount: creditAmount.toString(),
        originalPrice: priceResult.originalPrice.toString(),
        discountedPrice: priceResult.discountedPrice.toString(),
        discountPercentage: priceResult.discountPercentage.toString(),
        packageId: priceResult.appliedPackage?.id || 'none',
        ...metadata
      }
    );
    
    // Add credits to user
    const creditResult = await addCredits(
      userId,
      creditAmount,
      `Purchased ${creditAmount} credits`,
      'purchase',
      {
        paymentId: paymentResult.id,
        originalPrice: priceResult.originalPrice,
        discountedPrice: priceResult.discountedPrice,
        discountPercentage: priceResult.discountPercentage,
        packageId: priceResult.appliedPackage?.id,
        ...metadata
      }
    );
    
    return {
      userId,
      creditAmount,
      originalPrice: priceResult.originalPrice,
      discountedPrice: priceResult.discountedPrice,
      discountPercentage: priceResult.discountPercentage,
      savings: priceResult.savings,
      paymentId: paymentResult.id,
      transactionId: creditResult.transaction.id
    };
  } catch (error) {
    logger.error(`Failed to purchase credits: ${error}`);
    throw error;
  }
}

/**
 * Purchase a specific credit package
 * @param userId User ID
 * @param packageId Package ID
 * @param paymentMethodId Payment method ID
 * @param metadata Additional metadata
 * @returns Purchase result
 */
export async function purchaseCreditPackage(
  userId: string,
  packageId: string,
  paymentMethodId: string,
  metadata?: Record<string, any>
): Promise<PurchaseResult> {
  try {
    // Get the package
    const pkg = await bulkCreditModel.getBulkCreditPackageById(packageId);
    
    if (!pkg) {
      throw new Error('Invalid credit package');
    }
    
    if (!pkg.isActive) {
      throw new Error('Credit package is not active');
    }
    
    // Create Stripe customer if not exists
    const customer = await stripeService.getOrCreateCustomer(userId);
    
    if (!customer) {
      throw new Error('Failed to create Stripe customer');
    }
    
    // Process payment
    let paymentResult;
    
    if (pkg.stripePriceId) {
      // Use Stripe product/price if available
      paymentResult = await stripeService.createSubscriptionPayment(
        customer.id,
        pkg.stripePriceId,
        paymentMethodId,
        {
          userId,
          packageId: pkg.id,
          creditAmount: pkg.creditAmount.toString(),
          ...metadata
        }
      );
    } else {
      // Process as one-time payment
      paymentResult = await stripeService.createPayment(
        customer.id,
        Math.round(pkg.price * 100), // Convert to cents
        pkg.currency,
        paymentMethodId,
        `Purchase of ${pkg.name} credit package`,
        {
          userId,
          packageId: pkg.id,
          creditAmount: pkg.creditAmount.toString(),
          ...metadata
        }
      );
    }
    
    // Add credits to user
    const creditResult = await addCredits(
      userId,
      pkg.creditAmount,
      `Purchased ${pkg.name} credit package (${pkg.creditAmount} credits)`,
      'purchase',
      {
        paymentId: paymentResult.id,
        packageId: pkg.id,
        price: pkg.price,
        currency: pkg.currency,
        ...metadata
      }
    );
    
    // Calculate original price (without discount)
    const originalPrice = pkg.creditAmount * BASE_CREDIT_UNIT_PRICE;
    const savings = originalPrice - pkg.price;
    
    return {
      userId,
      creditAmount: pkg.creditAmount,
      originalPrice,
      discountedPrice: pkg.price,
      discountPercentage: pkg.discountPercentage,
      savings,
      paymentId: paymentResult.id,
      transactionId: creditResult.transaction.id
    };
  } catch (error) {
    logger.error(`Failed to purchase credit package: ${error}`);
    throw error;
  }
}

export default {
  getBulkCreditPackages,
  createBulkCreditPackage,
  updateBulkCreditPackage,
  deleteBulkCreditPackage,
  calculateCreditPrice,
  purchaseCredits,
  purchaseCreditPackage,
  BASE_CREDIT_UNIT_PRICE
};
