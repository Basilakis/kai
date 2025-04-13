/**
 * Credit Service
 * 
 * This service manages the credit system for API usage and third-party service integration.
 * It provides functionality for tracking credit usage, calculating costs, and managing user credits.
 */

import { logger } from '../../utils/logger';
import userCreditModel from '../../models/userCredit.model';
import serviceCostModel from '../../models/serviceCost.model';
import { UserCredit, CreditTransaction } from '../../models/userCredit.model';
import { ServiceCost } from '../../models/serviceCost.model';

/**
 * Credit Service class
 */
class CreditService {
  /**
   * Check if user has enough credits for a service
   * @param userId User ID
   * @param serviceKey Service key
   * @param units Number of units to be used
   * @returns Whether user has enough credits
   */
  public async hasEnoughCreditsForService(
    userId: string,
    serviceKey: string,
    units: number
  ): Promise<boolean> {
    try {
      // Calculate credit cost
      const creditCost = await serviceCostModel.calculateCreditCost(serviceKey, units);
      
      // Check if user has enough credits
      return await userCreditModel.hasEnoughCredits(userId, creditCost);
    } catch (error) {
      logger.error(`Failed to check if user has enough credits for service: ${error}`);
      return false;
    }
  }
  
  /**
   * Use credits for a service
   * @param userId User ID
   * @param serviceKey Service key
   * @param units Number of units used
   * @param description Transaction description
   * @param metadata Additional metadata
   * @returns Updated user credit and transaction
   */
  public async useServiceCredits(
    userId: string,
    serviceKey: string,
    units: number,
    description: string,
    metadata?: Record<string, any>
  ): Promise<{ userCredit: UserCredit; transaction: CreditTransaction }> {
    try {
      return await userCreditModel.useServiceCredits(
        userId,
        serviceKey,
        units,
        description,
        metadata
      );
    } catch (error) {
      logger.error(`Failed to use service credits: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get all service costs
   * @returns Array of service costs
   */
  public async getAllServiceCosts(): Promise<ServiceCost[]> {
    try {
      return await serviceCostModel.getAllServiceCosts();
    } catch (error) {
      logger.error(`Failed to get all service costs: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get service cost by key
   * @param serviceKey Service key
   * @returns Service cost or null if not found
   */
  public async getServiceCostByKey(serviceKey: string): Promise<ServiceCost | null> {
    try {
      return await serviceCostModel.getServiceCostByKey(serviceKey);
    } catch (error) {
      logger.error(`Failed to get service cost by key: ${error}`);
      throw error;
    }
  }
  
  /**
   * Create a new service cost
   * @param serviceCost Service cost to create
   * @returns Created service cost
   */
  public async createServiceCost(
    serviceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ServiceCost> {
    try {
      return await serviceCostModel.createServiceCost(serviceCost);
    } catch (error) {
      logger.error(`Failed to create service cost: ${error}`);
      throw error;
    }
  }
  
  /**
   * Update a service cost
   * @param id Service cost ID
   * @param updates Updates to apply
   * @returns Updated service cost
   */
  public async updateServiceCost(
    id: string,
    updates: Partial<Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ServiceCost> {
    try {
      return await serviceCostModel.updateServiceCost(id, updates);
    } catch (error) {
      logger.error(`Failed to update service cost: ${error}`);
      throw error;
    }
  }
  
  /**
   * Delete a service cost
   * @param id Service cost ID
   * @returns True if deleted successfully
   */
  public async deleteServiceCost(id: string): Promise<boolean> {
    try {
      return await serviceCostModel.deleteServiceCost(id);
    } catch (error) {
      logger.error(`Failed to delete service cost: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get user credit usage by service
   * @param userId User ID
   * @param limit Maximum number of transactions to return
   * @param offset Offset for pagination
   * @returns Credit usage by service
   */
  public async getUserCreditUsageByService(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<Record<string, { totalCredits: number, transactions: CreditTransaction[] }>> {
    try {
      return await userCreditModel.getCreditUsageByService(userId, limit, offset);
    } catch (error) {
      logger.error(`Failed to get user credit usage by service: ${error}`);
      throw error;
    }
  }
  
  /**
   * Get user credit balance
   * @param userId User ID
   * @returns User credit or null if not found
   */
  public async getUserCreditBalance(userId: string): Promise<UserCredit | null> {
    try {
      return await userCreditModel.getUserCredit(userId);
    } catch (error) {
      logger.error(`Failed to get user credit balance: ${error}`);
      throw error;
    }
  }
  
  /**
   * Add credits to user
   * @param userId User ID
   * @param amount Amount to add
   * @param description Transaction description
   * @param type Transaction type
   * @param metadata Additional metadata
   * @returns Updated user credit and transaction
   */
  public async addCreditsToUser(
    userId: string,
    amount: number,
    description: string,
    type: CreditTransaction['type'] = 'purchase',
    metadata?: Record<string, any>
  ): Promise<{ userCredit: UserCredit; transaction: CreditTransaction }> {
    try {
      return await userCreditModel.addCredits(userId, amount, description, type, metadata);
    } catch (error) {
      logger.error(`Failed to add credits to user: ${error}`);
      throw error;
    }
  }
  
  /**
   * Initialize user credit if it doesn't exist
   * @param userId User ID
   * @param initialBalance Initial credit balance
   * @returns User credit
   */
  public async initializeUserCredit(
    userId: string,
    initialBalance: number = 0
  ): Promise<UserCredit> {
    try {
      return await userCreditModel.initializeUserCredit(userId, initialBalance);
    } catch (error) {
      logger.error(`Failed to initialize user credit: ${error}`);
      throw error;
    }
  }
}

// Create singleton instance
const creditService = new CreditService();

export default creditService;
