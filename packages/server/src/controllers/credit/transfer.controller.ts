/**
 * Credit Transfer Controller
 * 
 * This controller handles API endpoints for credit transfers between users,
 * including initiating transfers and viewing transfer history.
 */

import { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { ApiError } from '../../middleware/error.middleware';
import transferService from '../../services/credit/transfer.service';
import { getUserCreditBalance } from '../../models/userCredit.model';

/**
 * Transfer credits to another user
 * @route POST /api/credits/transfer
 * @access Private
 */
export const transferCredits = async (req: Request, res: Response) => {
  try {
    const fromUserId = req.user.id;
    const { toUserId, toEmail, amount, note, metadata } = req.body;
    
    if (!amount || amount <= 0) {
      throw new ApiError(400, 'Amount is required and must be positive');
    }
    
    // Determine recipient
    let recipientId: string;
    
    if (toUserId) {
      recipientId = toUserId;
    } else if (toEmail) {
      // Find user by email
      const user = await transferService.findUserByEmail(toEmail);
      
      if (!user) {
        throw new ApiError(404, 'Recipient not found');
      }
      
      recipientId = user.id;
    } else {
      throw new ApiError(400, 'Either toUserId or toEmail is required');
    }
    
    // Check if trying to transfer to self
    if (fromUserId === recipientId) {
      throw new ApiError(400, 'Cannot transfer credits to yourself');
    }
    
    // Check if sender has enough credits
    const balance = await getUserCreditBalance(fromUserId);
    
    if (balance < amount) {
      throw new ApiError(400, `Insufficient credits. Available: ${balance}, Requested: ${amount}`);
    }
    
    // Process the transfer
    const result = await transferService.transferCredits(
      fromUserId,
      recipientId,
      amount,
      note,
      metadata
    );
    
    res.status(200).json({
      success: true,
      message: `Successfully transferred ${amount} credits`,
      data: result
    });
  } catch (error) {
    logger.error(`Error transferring credits: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to transfer credits');
  }
};

/**
 * Get transfer history for the current user
 * @route GET /api/credits/transfer/history
 * @access Private
 */
export const getTransferHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const type = req.query.type as 'sent' | 'received' | 'all' || 'all';
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    // Validate type
    if (type !== 'sent' && type !== 'received' && type !== 'all') {
      throw new ApiError(400, 'Invalid type. Must be "sent", "received", or "all"');
    }
    
    const history = await transferService.getTransferHistory(userId, type, limit, offset);
    
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error(`Error getting transfer history: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get transfer history');
  }
};

/**
 * Get a transfer by ID
 * @route GET /api/credits/transfer/:transferId
 * @access Private
 */
export const getTransferById = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { transferId } = req.params;
    
    const transfer = await transferService.getTransferById(transferId);
    
    if (!transfer) {
      throw new ApiError(404, 'Transfer not found');
    }
    
    // Check if the user is involved in the transfer
    if (transfer.fromUserId !== userId && transfer.toUserId !== userId) {
      throw new ApiError(403, 'You do not have permission to view this transfer');
    }
    
    res.status(200).json({
      success: true,
      data: transfer
    });
  } catch (error) {
    logger.error(`Error getting transfer: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to get transfer');
  }
};

/**
 * Find a user by email
 * @route GET /api/credits/transfer/find-user
 * @access Private
 */
export const findUserByEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      throw new ApiError(400, 'Email is required');
    }
    
    const user = await transferService.findUserByEmail(email as string);
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Don't allow transferring to self
    if (user.id === req.user.id) {
      throw new ApiError(400, 'Cannot transfer credits to yourself');
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error(`Error finding user: ${error}`);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to find user');
  }
};

export default {
  transferCredits,
  getTransferHistory,
  getTransferById,
  findUserByEmail
};
