import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import teamBillingService from '../../services/subscription/teamBilling.service';
import { TeamMemberStatus } from '../../models/teamSubscription.model';

// Mock dependencies
jest.mock('../../models/teamSubscription.model', () => ({
  getTeamById: jest.fn().mockResolvedValue({
    id: 'team-id',
    name: 'Test Team',
    ownerId: 'owner-id',
    tierId: 'basic',
    status: 'active',
    seats: 5,
    stripeSubscriptionId: 'sub_123',
    stripePriceId: 'price_123',
    stripeCustomerId: 'cus_123',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    metadata: {}
  }),
  updateTeam: jest.fn().mockImplementation((id, updates) => Promise.resolve({
    id: 'team-id',
    name: 'Test Team',
    ownerId: 'owner-id',
    tierId: updates.tierId || 'basic',
    status: updates.status || 'active',
    seats: updates.seats || 5,
    ...updates
  })),
  getTeamMembers: jest.fn().mockResolvedValue([
    { id: 'member-1', userId: 'user-1', status: TeamMemberStatus.ACTIVE },
    { id: 'member-2', userId: 'user-2', status: TeamMemberStatus.ACTIVE },
    { id: 'member-3', userId: 'user-3', status: TeamMemberStatus.INVITED }
  ]),
  TeamMemberStatus
}));

jest.mock('../../models/subscriptionTier.model', () => ({
  getSubscriptionTierById: jest.fn().mockImplementation((id) => Promise.resolve({
    id,
    name: id === 'basic' ? 'Basic' : 'Premium',
    price: id === 'basic' ? 10 : 20,
    currency: 'USD',
    billingInterval: 'monthly',
    stripePriceId: id === 'basic' ? 'price_123' : 'price_456'
  }))
}));

jest.mock('../../services/payment/stripeService', () => ({
  getOrCreateCustomer: jest.fn().mockResolvedValue({ id: 'cus_123' }),
  createSubscription: jest.fn().mockResolvedValue({
    id: 'sub_123',
    status: 'active',
    start_date: Math.floor(Date.now() / 1000),
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    cancel_at_period_end: false
  }),
  updateSubscriptionQuantity: jest.fn().mockResolvedValue({
    id: 'sub_123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  }),
  cancelSubscription: jest.fn().mockResolvedValue({
    id: 'sub_123',
    status: 'active',
    cancel_at_period_end: true
  }),
  updateSubscription: jest.fn().mockResolvedValue({
    id: 'sub_123',
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
  }),
  calculateProration: jest.fn().mockResolvedValue({
    currentAmount: 1000,
    newAmount: 2000,
    proratedAmount: 500,
    totalAmount: 1500,
    isUpgrade: true,
    isCredit: false
  }),
  previewSubscriptionUpdate: jest.fn().mockResolvedValue({
    currentAmount: 1000,
    newAmount: 1500,
    proratedAmount: 250,
    totalAmount: 750,
    isUpgrade: true,
    isCredit: false
  })
}));

describe('Team Billing Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateTeamSeats', () => {
    it('should update team seats', async () => {
      const result = await teamBillingService.updateTeamSeats('team-id', 10, true);
      
      expect(result).toBeDefined();
      expect(result.seats).toBe(10);
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').updateSubscriptionQuantity)
        .toHaveBeenCalledWith('sub_123', 10, true);
      
      // Verify team was updated in database
      expect(require('../../models/teamSubscription.model').updateTeam)
        .toHaveBeenCalledWith('team-id', expect.objectContaining({ seats: 10 }));
    });

    it('should throw error if seats are less than active members', async () => {
      await expect(teamBillingService.updateTeamSeats('team-id', 1, true))
        .rejects.toThrow('Cannot reduce seats below active member count');
    });
  });

  describe('changeTeamSubscriptionTier', () => {
    it('should change team subscription tier', async () => {
      const result = await teamBillingService.changeTeamSubscriptionTier('team-id', 'premium', true);
      
      expect(result).toBeDefined();
      expect(result.tierId).toBe('premium');
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').updateSubscription)
        .toHaveBeenCalledWith('sub_123', 'price_456', undefined);
      
      // Verify team was updated in database
      expect(require('../../models/teamSubscription.model').updateTeam)
        .toHaveBeenCalledWith('team-id', expect.objectContaining({ tierId: 'premium' }));
    });
  });

  describe('cancelTeamSubscription', () => {
    it('should cancel team subscription at period end', async () => {
      const result = await teamBillingService.cancelTeamSubscription('team-id', true);
      
      expect(result).toBeDefined();
      expect(result.cancelAtPeriodEnd).toBe(true);
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').cancelSubscription)
        .toHaveBeenCalledWith('sub_123', true);
      
      // Verify team was updated in database
      expect(require('../../models/teamSubscription.model').updateTeam)
        .toHaveBeenCalledWith('team-id', expect.objectContaining({ 
          cancelAtPeriodEnd: true,
          autoRenew: false
        }));
    });

    it('should cancel team subscription immediately', async () => {
      const result = await teamBillingService.cancelTeamSubscription('team-id', false);
      
      expect(result).toBeDefined();
      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.status).toBe('canceled');
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').cancelSubscription)
        .toHaveBeenCalledWith('sub_123', false);
      
      // Verify team was updated in database
      expect(require('../../models/teamSubscription.model').updateTeam)
        .toHaveBeenCalledWith('team-id', expect.objectContaining({ 
          cancelAtPeriodEnd: true,
          status: 'canceled',
          autoRenew: false
        }));
    });
  });

  describe('calculateTeamBillingPreview', () => {
    it('should calculate preview for seat change', async () => {
      const result = await teamBillingService.calculateTeamBillingPreview('team-id', 8);
      
      expect(result).toBeDefined();
      expect(result.currentSeats).toBe(5);
      expect(result.newSeats).toBe(8);
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').previewSubscriptionUpdate)
        .toHaveBeenCalledWith('sub_123', { quantity: 8 });
    });

    it('should calculate preview for tier change', async () => {
      const result = await teamBillingService.calculateTeamBillingPreview('team-id', undefined, 'premium');
      
      expect(result).toBeDefined();
      expect(result.currentTier).toBe('basic');
      expect(result.newTier).toBe('premium');
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').calculateProration)
        .toHaveBeenCalledWith('sub_123', 'price_456', undefined, 5);
    });
  });
});
