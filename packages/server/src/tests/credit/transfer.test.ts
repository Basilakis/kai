import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import transferService from '../../services/credit/transfer.service';

// Mock dependencies
jest.mock('../../models/userCredit.model', () => ({
  getUserCreditBalance: jest.fn().mockImplementation((userId) => {
    if (userId === 'user-with-credits') {
      return Promise.resolve(1000);
    }
    return Promise.resolve(0);
  }),
  addCredits: jest.fn().mockImplementation((userId, amount, description, type, metadata) => Promise.resolve({
    userId,
    amount,
    balance: 500 + amount,
    transaction: {
      id: 'tx-add-123',
      userId,
      amount,
      type,
      description,
      metadata
    }
  })),
  deductCredits: jest.fn().mockImplementation((userId, amount, description, type, metadata) => Promise.resolve({
    userId,
    amount: -amount,
    balance: 1000 - amount,
    transaction: {
      id: 'tx-deduct-123',
      userId,
      amount: -amount,
      type,
      description,
      metadata
    }
  }))
}));

jest.mock('../services/supabase/supabaseClient', () => ({
  getClient: jest.fn().mockReturnValue({
    auth: {
      admin: {
        getUserById: jest.fn().mockImplementation((id) => {
          if (id === 'user-not-found') {
            return Promise.resolve({ data: null, error: { message: 'User not found' } });
          }
          return Promise.resolve({
            data: {
              id,
              email: `${id}@example.com`,
              user_metadata: {
                full_name: `User ${id}`
              }
            },
            error: null
          });
        }),
        listUsers: jest.fn().mockResolvedValue({
          data: {
            users: [
              {
                id: 'user-1',
                email: 'user-1@example.com',
                user_metadata: { full_name: 'User One' }
              },
              {
                id: 'user-2',
                email: 'user-2@example.com',
                user_metadata: { full_name: 'User Two' }
              },
              {
                id: 'user-with-credits',
                email: 'rich-user@example.com',
                user_metadata: { full_name: 'Rich User' }
              }
            ]
          },
          error: null
        })
      }
    },
    from: jest.fn().mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [{ id: 'transfer-123', fromUserId: 'user-with-credits', toUserId: 'user-1', amount: 100 }],
          error: null
        })
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: [{ id: 'transfer-123', status: 'completed' }],
            error: null
          })
        })
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              range: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'transfer-1',
                    fromUserId: 'user-with-credits',
                    toUserId: 'user-1',
                    amount: 100,
                    status: 'completed',
                    createdAt: new Date().toISOString(),
                    fromUser: { id: 'user-with-credits', email: 'rich-user@example.com', user_metadata: { full_name: 'Rich User' } },
                    toUser: { id: 'user-1', email: 'user-1@example.com', user_metadata: { full_name: 'User One' } }
                  }
                ],
                error: null
              })
            }),
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'transfer-123',
                fromUserId: 'user-with-credits',
                toUserId: 'user-1',
                amount: 100,
                status: 'completed',
                createdAt: new Date().toISOString(),
                fromUser: { id: 'user-with-credits', email: 'rich-user@example.com', user_metadata: { full_name: 'Rich User' } },
                toUser: { id: 'user-1', email: 'user-1@example.com', user_metadata: { full_name: 'User One' } }
              },
              error: null
            })
          })
        })
      })
    })
  })
}));

describe('Credit Transfer Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('transferCredits', () => {
    it('should transfer credits between users', async () => {
      const result = await transferService.transferCredits(
        'user-with-credits',
        'user-1',
        100,
        'Test transfer'
      );
      
      expect(result).toBeDefined();
      expect(result.fromUserId).toBe('user-with-credits');
      expect(result.toUserId).toBe('user-1');
      expect(result.amount).toBe(100);
      expect(result.fromTransactionId).toBe('tx-deduct-123');
      expect(result.toTransactionId).toBe('tx-add-123');
      
      // Verify credits were deducted from sender
      expect(require('../../models/userCredit.model').deductCredits)
        .toHaveBeenCalledWith(
          'user-with-credits',
          100,
          expect.stringContaining('Transfer to'),
          'transfer_out',
          expect.objectContaining({
            transferId: 'transfer-123',
            toUserId: 'user-1'
          })
        );
      
      // Verify credits were added to recipient
      expect(require('../../models/userCredit.model').addCredits)
        .toHaveBeenCalledWith(
          'user-1',
          100,
          expect.stringContaining('Transfer from'),
          'transfer_in',
          expect.objectContaining({
            transferId: 'transfer-123',
            fromUserId: 'user-with-credits'
          })
        );
    });

    it('should throw error if sender has insufficient credits', async () => {
      await expect(transferService.transferCredits(
        'user-1', // User with 0 credits
        'user-2',
        100,
        'Test transfer'
      )).rejects.toThrow('Insufficient credits');
    });

    it('should throw error if trying to transfer to self', async () => {
      await expect(transferService.transferCredits(
        'user-with-credits',
        'user-with-credits',
        100,
        'Test transfer'
      )).rejects.toThrow('Cannot transfer credits to yourself');
    });

    it('should throw error if recipient does not exist', async () => {
      await expect(transferService.transferCredits(
        'user-with-credits',
        'user-not-found',
        100,
        'Test transfer'
      )).rejects.toThrow('Recipient user not found');
    });

    it('should throw error if amount is not positive', async () => {
      await expect(transferService.transferCredits(
        'user-with-credits',
        'user-1',
        0,
        'Test transfer'
      )).rejects.toThrow('Transfer amount must be positive');

      await expect(transferService.transferCredits(
        'user-with-credits',
        'user-1',
        -10,
        'Test transfer'
      )).rejects.toThrow('Transfer amount must be positive');
    });
  });

  describe('getTransferHistory', () => {
    it('should get transfer history for a user', async () => {
      const history = await transferService.getTransferHistory('user-with-credits', 'all', 10, 0);
      
      expect(history).toBeDefined();
      expect(history).toHaveLength(1);
      expect(history[0].fromUserId).toBe('user-with-credits');
      expect(history[0].toUserId).toBe('user-1');
      expect(history[0].amount).toBe(100);
      expect(history[0].status).toBe('completed');
    });
  });

  describe('findUserByEmail', () => {
    it('should find a user by email', async () => {
      const user = await transferService.findUserByEmail('user-1@example.com');
      
      expect(user).toBeDefined();
      expect(user?.id).toBe('user-1');
      expect(user?.email).toBe('user-1@example.com');
      expect(user?.name).toBe('User One');
    });

    it('should return null if user not found', async () => {
      const user = await transferService.findUserByEmail('nonexistent@example.com');
      
      expect(user).toBeNull();
    });
  });
});
