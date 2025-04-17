/**
 * Credit Transfer Service
 * 
 * This service provides functionality for transferring credits between users,
 * including validation, authorization, and transaction recording.
 */

import { logger } from '../../utils/logger';
import { 
  getUserCreditBalance, 
  addCredits, 
  deductCredits 
} from '../../models/userCredit.model';
import { supabaseClient } from '../supabase/supabaseClient';

/**
 * Transfer result
 */
export interface TransferResult {
  fromUserId: string;
  toUserId: string;
  amount: number;
  fromBalance: number;
  toBalance: number;
  fromTransactionId: string;
  toTransactionId: string;
  transferId: string;
  timestamp: Date;
}

/**
 * Transfer credits between users
 * @param fromUserId Sender user ID
 * @param toUserId Recipient user ID
 * @param amount Amount of credits to transfer
 * @param note Note for the transfer
 * @param metadata Additional metadata
 * @returns Transfer result
 */
export async function transferCredits(
  fromUserId: string,
  toUserId: string,
  amount: number,
  note?: string,
  metadata?: Record<string, any>
): Promise<TransferResult> {
  try {
    // Validate input
    if (fromUserId === toUserId) {
      throw new Error('Cannot transfer credits to yourself');
    }
    
    if (amount <= 0) {
      throw new Error('Transfer amount must be positive');
    }
    
    // Check if recipient exists
    const { data: toUser, error: toUserError } = await supabaseClient.getClient().auth.admin.getUserById(toUserId);
    
    if (toUserError || !toUser) {
      throw new Error('Recipient user not found');
    }
    
    // Check if sender has enough credits
    const fromBalance = await getUserCreditBalance(fromUserId);
    
    if (fromBalance < amount) {
      throw new Error(`Insufficient credits. Available: ${fromBalance}, Requested: ${amount}`);
    }
    
    // Create transfer record
    const now = new Date();
    const transferData = {
      fromUserId,
      toUserId,
      amount,
      note,
      status: 'pending',
      createdAt: now,
      metadata
    };
    
    const { data: transfer, error: transferError } = await supabaseClient.getClient()
      .from('credit_transfers')
      .insert([transferData])
      .select();
    
    if (transferError || !transfer || transfer.length === 0) {
      throw new Error(`Failed to create transfer record: ${transferError?.message || 'Unknown error'}`);
    }
    
    const transferId = transfer[0].id;
    
    try {
      // Deduct credits from sender
      const deductResult = await deductCredits(
        fromUserId,
        amount,
        `Transfer to ${toUser.email || toUserId}${note ? `: ${note}` : ''}`,
        'transfer_out',
        {
          transferId,
          toUserId,
          ...metadata
        }
      );
      
      // Add credits to recipient
      const addResult = await addCredits(
        toUserId,
        amount,
        `Transfer from ${fromUserId}${note ? `: ${note}` : ''}`,
        'transfer_in',
        {
          transferId,
          fromUserId,
          ...metadata
        }
      );
      
      // Update transfer status
      const { error: updateError } = await supabaseClient.getClient()
        .from('credit_transfers')
        .update({
          status: 'completed',
          completedAt: new Date(),
          fromTransactionId: deductResult.transaction.id,
          toTransactionId: addResult.transaction.id
        })
        .eq('id', transferId);
      
      if (updateError) {
        logger.error(`Failed to update transfer status: ${updateError.message}`);
      }
      
      // Get updated balances
      const newFromBalance = await getUserCreditBalance(fromUserId);
      const newToBalance = await getUserCreditBalance(toUserId);
      
      return {
        fromUserId,
        toUserId,
        amount,
        fromBalance: newFromBalance,
        toBalance: newToBalance,
        fromTransactionId: deductResult.transaction.id,
        toTransactionId: addResult.transaction.id,
        transferId,
        timestamp: now
      };
    } catch (error) {
      // Update transfer status to failed
      const { error: updateError } = await supabaseClient.getClient()
        .from('credit_transfers')
        .update({
          status: 'failed',
          errorMessage: error.message
        })
        .eq('id', transferId);
      
      if (updateError) {
        logger.error(`Failed to update transfer status: ${updateError.message}`);
      }
      
      throw error;
    }
  } catch (error) {
    logger.error(`Failed to transfer credits: ${error}`);
    throw error;
  }
}

/**
 * Get transfer history for a user
 * @param userId User ID
 * @param type Transfer type ('sent', 'received', or 'all')
 * @param limit Maximum number of records to return
 * @param offset Offset for pagination
 * @returns Array of transfer records
 */
export async function getTransferHistory(
  userId: string,
  type: 'sent' | 'received' | 'all' = 'all',
  limit: number = 10,
  offset: number = 0
): Promise<any[]> {
  try {
    let query = supabaseClient.getClient()
      .from('credit_transfers')
      .select(`
        *,
        fromUser:fromUserId(id, email, user_metadata),
        toUser:toUserId(id, email, user_metadata)
      `)
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (type === 'sent') {
      query = query.eq('fromUserId', userId);
    } else if (type === 'received') {
      query = query.eq('toUserId', userId);
    } else {
      query = query.or(`fromUserId.eq.${userId},toUserId.eq.${userId}`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get transfer history: ${error.message}`);
    }
    
    // Format the results
    return (data || []).map(transfer => ({
      id: transfer.id,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      amount: transfer.amount,
      note: transfer.note,
      status: transfer.status,
      createdAt: transfer.createdAt,
      completedAt: transfer.completedAt,
      fromUser: transfer.fromUser ? {
        id: transfer.fromUser.id,
        email: transfer.fromUser.email,
        name: transfer.fromUser.user_metadata?.full_name || transfer.fromUser.email?.split('@')[0]
      } : null,
      toUser: transfer.toUser ? {
        id: transfer.toUser.id,
        email: transfer.toUser.email,
        name: transfer.toUser.user_metadata?.full_name || transfer.toUser.email?.split('@')[0]
      } : null,
      direction: transfer.fromUserId === userId ? 'sent' : 'received'
    }));
  } catch (error) {
    logger.error(`Failed to get transfer history: ${error}`);
    throw error;
  }
}

/**
 * Get a transfer by ID
 * @param transferId Transfer ID
 * @returns Transfer record
 */
export async function getTransferById(transferId: string): Promise<any> {
  try {
    const { data, error } = await supabaseClient.getClient()
      .from('credit_transfers')
      .select(`
        *,
        fromUser:fromUserId(id, email, user_metadata),
        toUser:toUserId(id, email, user_metadata)
      `)
      .eq('id', transferId)
      .single();
    
    if (error) {
      throw new Error(`Failed to get transfer: ${error.message}`);
    }
    
    if (!data) {
      return null;
    }
    
    // Format the result
    return {
      id: data.id,
      fromUserId: data.fromUserId,
      toUserId: data.toUserId,
      amount: data.amount,
      note: data.note,
      status: data.status,
      createdAt: data.createdAt,
      completedAt: data.completedAt,
      fromTransactionId: data.fromTransactionId,
      toTransactionId: data.toTransactionId,
      errorMessage: data.errorMessage,
      metadata: data.metadata,
      fromUser: data.fromUser ? {
        id: data.fromUser.id,
        email: data.fromUser.email,
        name: data.fromUser.user_metadata?.full_name || data.fromUser.email?.split('@')[0]
      } : null,
      toUser: data.toUser ? {
        id: data.toUser.id,
        email: data.toUser.email,
        name: data.toUser.user_metadata?.full_name || data.toUser.email?.split('@')[0]
      } : null
    };
  } catch (error) {
    logger.error(`Failed to get transfer: ${error}`);
    throw error;
  }
}

/**
 * Find a user by email
 * @param email User email
 * @returns User ID and details if found
 */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string; name?: string } | null> {
  try {
    const { data, error } = await supabaseClient.getClient().auth.admin.listUsers();
    
    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
    
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.full_name || user.email?.split('@')[0]
    };
  } catch (error) {
    logger.error(`Failed to find user by email: ${error}`);
    throw error;
  }
}

export default {
  transferCredits,
  getTransferHistory,
  getTransferById,
  findUserByEmail
};
