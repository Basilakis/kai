/**
 * Service Cost Admin Controller
 * 
 * This controller handles admin APIs for managing service costs.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../utils/apiError';
import creditService from '../../services/credit/creditService';

/**
 * Get all service costs
 * @param req Request
 * @param res Response
 */
export const getAllServiceCosts = async (req: Request, res: Response) => {
  try {
    const serviceCosts = await creditService.getAllServiceCosts();
    
    res.status(200).json({
      success: true,
      data: serviceCosts
    });
  } catch (error) {
    logger.error(`Error getting all service costs: ${error}`);
    throw new ApiError(500, 'Failed to get service costs');
  }
};

/**
 * Get service cost by ID
 * @param req Request
 * @param res Response
 */
export const getServiceCostById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get service cost by key (using ID as key for now)
    const serviceCost = await creditService.getServiceCostByKey(id);
    
    if (!serviceCost) {
      throw new ApiError(404, 'Service cost not found');
    }
    
    res.status(200).json({
      success: true,
      data: serviceCost
    });
  } catch (error) {
    logger.error(`Error getting service cost by ID: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get service cost');
  }
};

/**
 * Create a new service cost
 * @param req Request
 * @param res Response
 */
export const createServiceCost = async (req: Request, res: Response) => {
  try {
    const {
      serviceName,
      serviceKey,
      costPerUnit,
      unitType,
      multiplier,
      description,
      isActive
    } = req.body;
    
    // Validate required fields
    if (!serviceName || !serviceKey || costPerUnit === undefined || !unitType) {
      throw new ApiError(400, 'Missing required fields');
    }
    
    // Create service cost
    const serviceCost = await creditService.createServiceCost({
      serviceName,
      serviceKey,
      costPerUnit: parseFloat(costPerUnit),
      unitType,
      multiplier: multiplier ? parseFloat(multiplier) : 1.0,
      description,
      isActive: isActive !== undefined ? isActive : true
    });
    
    res.status(201).json({
      success: true,
      data: serviceCost
    });
  } catch (error) {
    logger.error(`Error creating service cost: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to create service cost');
  }
};

/**
 * Update a service cost
 * @param req Request
 * @param res Response
 */
export const updateServiceCost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      serviceName,
      serviceKey,
      costPerUnit,
      unitType,
      multiplier,
      description,
      isActive
    } = req.body;
    
    // Create updates object with only provided fields
    const updates: any = {};
    
    if (serviceName !== undefined) updates.serviceName = serviceName;
    if (serviceKey !== undefined) updates.serviceKey = serviceKey;
    if (costPerUnit !== undefined) updates.costPerUnit = parseFloat(costPerUnit);
    if (unitType !== undefined) updates.unitType = unitType;
    if (multiplier !== undefined) updates.multiplier = parseFloat(multiplier);
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    
    // Update service cost
    const serviceCost = await creditService.updateServiceCost(id, updates);
    
    res.status(200).json({
      success: true,
      data: serviceCost
    });
  } catch (error) {
    logger.error(`Error updating service cost: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to update service cost');
  }
};

/**
 * Delete a service cost
 * @param req Request
 * @param res Response
 */
export const deleteServiceCost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Delete service cost
    await creditService.deleteServiceCost(id);
    
    res.status(200).json({
      success: true,
      message: 'Service cost deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting service cost: ${error}`);
    throw new ApiError(500, 'Failed to delete service cost');
  }
};

export default {
  getAllServiceCosts,
  getServiceCostById,
  createServiceCost,
  updateServiceCost,
  deleteServiceCost
};
