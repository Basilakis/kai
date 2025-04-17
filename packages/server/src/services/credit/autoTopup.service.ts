/**
 * Auto Top-up Service
 * 
 * This service provides functionality for automatic credit top-ups,
 * including monitoring credit balances and triggering top-ups when needed.
 */

import { logger } from '../../utils/logger';
import creditTopupModel, { 
  CreditTopupSetting, 
  CreditTopupHistory 
} from '../../models/creditTopup.model';
import { getUserCreditBalance } from '../../models/userCredit.model';
import bulkPurchaseService from './bulkPurchase.service';
import stripeService from '../payment/stripeService';

/**
 * Get credit top-up setting for a user
 * @param userId User ID
 * @returns Credit top-up setting or null if not found
 */
export async function getTopupSetting(userId: string): Promise<CreditTopupSetting | null> {
  try {
    return await creditTopupModel.getUserTopupSetting(userId);
  } catch (error) {
    logger.error(`Failed to get top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Create or update credit top-up setting
 * @param userId User ID
 * @param isEnabled Whether auto top-up is enabled
 * @param thresholdAmount Credit threshold to trigger top-up
 * @param topupAmount Amount of credits to purchase
 * @param maxMonthlySpend Maximum monthly spend limit
 * @param paymentMethodId Payment method ID
 * @param metadata Additional metadata
 * @returns Created or updated credit top-up setting
 */
export async function createOrUpdateTopupSetting(
  userId: string,
  isEnabled: boolean,
  thresholdAmount: number,
  topupAmount: number,
  maxMonthlySpend?: number,
  paymentMethodId?: string,
  metadata?: Record<string, any>
): Promise<CreditTopupSetting> {
  try {
    // Validate input
    if (thresholdAmount < 0) {
      throw new Error('Threshold amount must be non-negative');
    }
    
    if (topupAmount <= 0) {
      throw new Error('Top-up amount must be positive');
    }
    
    if (maxMonthlySpend !== undefined && maxMonthlySpend <= 0) {
      throw new Error('Maximum monthly spend must be positive');
    }
    
    // If enabling top-up, payment method is required
    if (isEnabled && !paymentMethodId) {
      throw new Error('Payment method is required when enabling auto top-up');
    }
    
    // Create or update setting
    const setting = await creditTopupModel.createOrUpdateTopupSetting({
      userId,
      isEnabled,
      thresholdAmount,
      topupAmount,
      maxMonthlySpend,
      paymentMethodId,
      metadata
    });
    
    return setting;
  } catch (error) {
    logger.error(`Failed to create or update top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Delete credit top-up setting
 * @param userId User ID
 * @returns Whether the setting was deleted
 */
export async function deleteTopupSetting(userId: string): Promise<boolean> {
  try {
    return await creditTopupModel.deleteTopupSetting(userId);
  } catch (error) {
    logger.error(`Failed to delete top-up setting: ${error}`);
    throw error;
  }
}

/**
 * Get credit top-up history for a user
 * @param userId User ID
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Array of credit top-up history records
 */
export async function getTopupHistory(
  userId: string,
  limit: number = 10,
  offset: number = 0
): Promise<CreditTopupHistory[]> {
  try {
    return await creditTopupModel.getUserTopupHistory(userId, limit, offset);
  } catch (error) {
    logger.error(`Failed to get top-up history: ${error}`);
    throw error;
  }
}

/**
 * Process a credit top-up for a user
 * @param userId User ID
 * @param settingId Setting ID
 * @param setting Top-up setting
 * @returns Top-up result
 */
export async function processTopup(
  userId: string,
  settingId: string,
  setting: CreditTopupSetting
): Promise<CreditTopupHistory> {
  try {
    // Calculate price
    const priceResult = await bulkPurchaseService.calculateCreditPrice(setting.topupAmount);
    
    // Create history record
    const history = await creditTopupModel.createTopupHistory({
      userId,
      settingId,
      creditAmount: setting.topupAmount,
      price: priceResult.discountedPrice,
      currency: 'USD',
      status: 'pending',
      metadata: {
        originalPrice: priceResult.originalPrice,
        discountPercentage: priceResult.discountPercentage,
        savings: priceResult.savings,
        packageId: priceResult.appliedPackage?.id
      }
    });
    
    try {
      // Process payment
      if (!setting.paymentMethodId) {
        throw new Error('No payment method available');
      }
      
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
        setting.paymentMethodId,
        `Automatic top-up of ${setting.topupAmount} credits`,
        {
          userId,
          settingId,
          historyId: history.id,
          creditAmount: setting.topupAmount.toString(),
          isAutoTopup: 'true'
        }
      );
      
      // Add credits to user
      await bulkPurchaseService.purchaseCredits(
        userId,
        setting.topupAmount,
        setting.paymentMethodId,
        {
          isAutoTopup: true,
          historyId: history.id
        }
      );
      
      // Update history record
      const updatedHistory = await creditTopupModel.updateTopupHistory(history.id, {
        status: 'completed',
        paymentId: paymentResult.id,
        completedAt: new Date()
      });
      
      // Update monthly spend
      await creditTopupModel.updateMonthlySpend(settingId, priceResult.discountedPrice);
      
      // Update last top-up time
      await creditTopupModel.updateLastTopupTime(settingId);
      
      return updatedHistory;
    } catch (error) {
      // Update history record with error
      const updatedHistory = await creditTopupModel.updateTopupHistory(history.id, {
        status: 'failed',
        errorMessage: error.message
      });
      
      logger.error(`Failed to process top-up payment: ${error}`);
      return updatedHistory;
    }
  } catch (error) {
    logger.error(`Failed to process top-up: ${error}`);
    throw error;
  }
}

/**
 * Check if a user needs a credit top-up
 * @param userId User ID
 * @returns Whether the user needs a top-up and the setting if applicable
 */
export async function checkUserNeedsTopup(userId: string): Promise<{ needsTopup: boolean; setting?: CreditTopupSetting }> {
  try {
    // Get user's top-up setting
    const setting = await creditTopupModel.getUserTopupSetting(userId);
    
    if (!setting || !setting.isEnabled || !setting.paymentMethodId) {
      return { needsTopup: false };
    }
    
    // Get user's credit balance
    const balance = await getUserCreditBalance(userId);
    
    // Check if balance is below threshold
    if (balance <= setting.thresholdAmount) {
      // Check if monthly spend limit is not exceeded
      if (setting.maxMonthlySpend) {
        const monthlySpend = setting.monthlySpend || 0;
        
        // Calculate price for top-up
        const priceResult = await bulkPurchaseService.calculateCreditPrice(setting.topupAmount);
        
        // Check if top-up would exceed monthly spend limit
        if (monthlySpend + priceResult.discountedPrice > setting.maxMonthlySpend) {
          return { needsTopup: false, setting };
        }
      }
      
      return { needsTopup: true, setting };
    }
    
    return { needsTopup: false, setting };
  } catch (error) {
    logger.error(`Failed to check if user needs top-up: ${error}`);
    throw error;
  }
}

/**
 * Process all users who need a credit top-up
 * @returns Number of users processed
 */
export async function processAllTopups(): Promise<number> {
  try {
    // Get users who need a top-up
    const users = await creditTopupModel.getUsersNeedingTopup();
    
    if (!users || users.length === 0) {
      return 0;
    }
    
    let processedCount = 0;
    
    // Process each user
    for (const user of users) {
      try {
        await processTopup(user.userId, user.settingId, user.setting);
        processedCount++;
      } catch (error) {
        logger.error(`Failed to process top-up for user ${user.userId}: ${error}`);
      }
    }
    
    return processedCount;
  } catch (error) {
    logger.error(`Failed to process all top-ups: ${error}`);
    throw error;
  }
}

/**
 * Schedule periodic checking for users who need a credit top-up
 * @param intervalMinutes Interval in minutes
 */
export function scheduleTopupChecks(intervalMinutes: number = 60): void {
  setInterval(async () => {
    try {
      const count = await processAllTopups();
      if (count > 0) {
        logger.info(`Processed ${count} automatic credit top-ups`);
      }
    } catch (error) {
      logger.error(`Failed to process scheduled top-ups: ${error}`);
    }
  }, intervalMinutes * 60 * 1000);
}

export default {
  getTopupSetting,
  createOrUpdateTopupSetting,
  deleteTopupSetting,
  getTopupHistory,
  processTopup,
  checkUserNeedsTopup,
  processAllTopups,
  scheduleTopupChecks
};
