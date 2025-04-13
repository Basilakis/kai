/**
 * Service Cost Model
 * 
 * This model handles the costs of third-party API services that can be configured by admins.
 * It provides functionality for calculating credit costs for API usage.
 */

import { supabaseClient } from '../services/supabase/supabaseClient';
import { logger } from '../utils/logger';

/**
 * Represents a service cost
 */
export interface ServiceCost {
  id: string;
  serviceName: string;
  serviceKey: string;
  costPerUnit: number;
  unitType: string;
  multiplier: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Get all service costs
 * @returns Array of service costs
 */
export async function getAllServiceCosts(): Promise<ServiceCost[]> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('service_costs')
      .select('*')
      .order('serviceName', { ascending: true });
    
    if (error) {
      logger.error(`Error fetching service costs: ${error.message}`);
      throw error;
    }
    
    return data.map(item => ({
      id: item.id,
      serviceName: item.service_name,
      serviceKey: item.service_key,
      costPerUnit: parseFloat(item.cost_per_unit),
      unitType: item.unit_type,
      multiplier: parseFloat(item.multiplier),
      description: item.description,
      isActive: item.is_active,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }));
  } catch (error) {
    logger.error(`Failed to get service costs: ${error}`);
    throw error;
  }
}

/**
 * Get service cost by key
 * @param serviceKey Service key
 * @returns Service cost or null if not found
 */
export async function getServiceCostByKey(serviceKey: string): Promise<ServiceCost | null> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('service_costs')
      .select('*')
      .eq('service_key', serviceKey)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      logger.error(`Error fetching service cost: ${error.message}`);
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    return {
      id: data.id,
      serviceName: data.service_name,
      serviceKey: data.service_key,
      costPerUnit: parseFloat(data.cost_per_unit),
      unitType: data.unit_type,
      multiplier: parseFloat(data.multiplier),
      description: data.description,
      isActive: data.is_active,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
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
export async function createServiceCost(serviceCost: Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceCost> {
  try {
    const now = new Date();
    const newServiceCost = {
      service_name: serviceCost.serviceName,
      service_key: serviceCost.serviceKey,
      cost_per_unit: serviceCost.costPerUnit,
      unit_type: serviceCost.unitType,
      multiplier: serviceCost.multiplier,
      description: serviceCost.description,
      is_active: serviceCost.isActive,
      created_at: now,
      updated_at: now
    };
    
    const { data, error } = await supabaseClient.getClient()
      .from('service_costs')
      .insert([newServiceCost])
      .select();
    
    if (error) {
      logger.error(`Error creating service cost: ${error.message}`);
      throw error;
    }
    
    return {
      id: data[0].id,
      serviceName: data[0].service_name,
      serviceKey: data[0].service_key,
      costPerUnit: parseFloat(data[0].cost_per_unit),
      unitType: data[0].unit_type,
      multiplier: parseFloat(data[0].multiplier),
      description: data[0].description,
      isActive: data[0].is_active,
      createdAt: new Date(data[0].created_at),
      updatedAt: new Date(data[0].updated_at)
    };
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
export async function updateServiceCost(
  id: string, 
  updates: Partial<Omit<ServiceCost, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<ServiceCost> {
  try {
    const updateData: any = {
      updated_at: new Date()
    };
    
    if (updates.serviceName !== undefined) updateData.service_name = updates.serviceName;
    if (updates.serviceKey !== undefined) updateData.service_key = updates.serviceKey;
    if (updates.costPerUnit !== undefined) updateData.cost_per_unit = updates.costPerUnit;
    if (updates.unitType !== undefined) updateData.unit_type = updates.unitType;
    if (updates.multiplier !== undefined) updateData.multiplier = updates.multiplier;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    
    const { data, error } = await supabaseClient.getClient()
      .from('service_costs')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      logger.error(`Error updating service cost: ${error.message}`);
      throw error;
    }
    
    return {
      id: data[0].id,
      serviceName: data[0].service_name,
      serviceKey: data[0].service_key,
      costPerUnit: parseFloat(data[0].cost_per_unit),
      unitType: data[0].unit_type,
      multiplier: parseFloat(data[0].multiplier),
      description: data[0].description,
      isActive: data[0].is_active,
      createdAt: new Date(data[0].created_at),
      updatedAt: new Date(data[0].updated_at)
    };
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
export async function deleteServiceCost(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseClient.getClient()
      .from('service_costs')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`Error deleting service cost: ${error.message}`);
      throw error;
    }
    
    return true;
  } catch (error) {
    logger.error(`Failed to delete service cost: ${error}`);
    throw error;
  }
}

/**
 * Calculate credit cost for service usage
 * @param serviceKey Service key
 * @param units Number of units used
 * @returns Calculated credit cost
 */
export async function calculateCreditCost(serviceKey: string, units: number): Promise<number> {
  try {
    const serviceCost = await getServiceCostByKey(serviceKey);
    
    if (!serviceCost) {
      logger.warn(`Service cost not found for key: ${serviceKey}, using default cost`);
      // Default to a small cost if service not found
      return Math.ceil(units * 0.0001);
    }
    
    if (!serviceCost.isActive) {
      logger.warn(`Service ${serviceKey} is not active, using default cost`);
      // Default to a small cost if service is not active
      return Math.ceil(units * 0.0001);
    }
    
    // Calculate cost: units * costPerUnit * multiplier
    const cost = units * serviceCost.costPerUnit * serviceCost.multiplier;
    
    // Round up to nearest integer for credit usage
    return Math.ceil(cost);
  } catch (error) {
    logger.error(`Failed to calculate credit cost: ${error}`);
    // Default to a small cost in case of error
    return Math.ceil(units * 0.0001);
  }
}

export default {
  getAllServiceCosts,
  getServiceCostByKey,
  createServiceCost,
  updateServiceCost,
  deleteServiceCost,
  calculateCreditCost
};
