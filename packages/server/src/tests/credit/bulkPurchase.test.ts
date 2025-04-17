import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import bulkPurchaseService from '../../services/credit/bulkPurchase.service';

// Mock dependencies
jest.mock('../../models/bulkCredit.model', () => ({
  getAllBulkCreditPackages: jest.fn().mockResolvedValue([
    {
      id: 'pkg-1',
      name: 'Small Package',
      creditAmount: 1000,
      price: 9.0,
      currency: 'USD',
      discountPercentage: 10,
      isActive: true
    },
    {
      id: 'pkg-2',
      name: 'Medium Package',
      creditAmount: 5000,
      price: 40.0,
      currency: 'USD',
      discountPercentage: 20,
      isActive: true
    },
    {
      id: 'pkg-3',
      name: 'Large Package',
      creditAmount: 10000,
      price: 70.0,
      currency: 'USD',
      discountPercentage: 30,
      isActive: true
    }
  ]),
  getBulkCreditPackageById: jest.fn().mockImplementation((id) => {
    const packages = {
      'pkg-1': {
        id: 'pkg-1',
        name: 'Small Package',
        creditAmount: 1000,
        price: 9.0,
        currency: 'USD',
        discountPercentage: 10,
        isActive: true
      },
      'pkg-2': {
        id: 'pkg-2',
        name: 'Medium Package',
        creditAmount: 5000,
        price: 40.0,
        currency: 'USD',
        discountPercentage: 20,
        isActive: true
      },
      'pkg-3': {
        id: 'pkg-3',
        name: 'Large Package',
        creditAmount: 10000,
        price: 70.0,
        currency: 'USD',
        discountPercentage: 30,
        isActive: true
      }
    };
    return Promise.resolve(packages[id] || null);
  }),
  createBulkCreditPackage: jest.fn().mockImplementation((pkg) => Promise.resolve({
    id: 'new-pkg',
    ...pkg
  })),
  updateBulkCreditPackage: jest.fn().mockImplementation((id, updates) => Promise.resolve({
    id,
    name: 'Updated Package',
    ...updates
  })),
  deleteBulkCreditPackage: jest.fn().mockResolvedValue(true),
  calculateCreditPrice: jest.fn().mockImplementation((creditAmount, unitPrice) => {
    let appliedPackage = null;
    let discountPercentage = 0;
    
    if (creditAmount >= 10000) {
      appliedPackage = {
        id: 'pkg-3',
        name: 'Large Package',
        discountPercentage: 30
      };
      discountPercentage = 30;
    } else if (creditAmount >= 5000) {
      appliedPackage = {
        id: 'pkg-2',
        name: 'Medium Package',
        discountPercentage: 20
      };
      discountPercentage = 20;
    } else if (creditAmount >= 1000) {
      appliedPackage = {
        id: 'pkg-1',
        name: 'Small Package',
        discountPercentage: 10
      };
      discountPercentage = 10;
    }
    
    const originalPrice = creditAmount * unitPrice;
    const discountMultiplier = 1 - (discountPercentage / 100);
    const discountedPrice = originalPrice * discountMultiplier;
    
    return Promise.resolve({
      originalPrice,
      discountedPrice,
      discountPercentage,
      savings: originalPrice - discountedPrice,
      appliedPackage
    });
  })
}));

jest.mock('../../models/userCredit.model', () => ({
  addCredits: jest.fn().mockImplementation((userId, amount, description, type, metadata) => Promise.resolve({
    userId,
    amount,
    balance: 5000 + amount,
    transaction: {
      id: 'tx-123',
      userId,
      amount,
      type,
      description,
      metadata
    }
  }))
}));

jest.mock('../../services/payment/stripeService', () => ({
  getOrCreateCustomer: jest.fn().mockResolvedValue({ id: 'cus_123' }),
  createPayment: jest.fn().mockResolvedValue({ id: 'pm_123' }),
  createSubscriptionPayment: jest.fn().mockResolvedValue({ id: 'sub_123' })
}));

describe('Bulk Purchase Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBulkCreditPackages', () => {
    it('should return all bulk credit packages', async () => {
      const packages = await bulkPurchaseService.getBulkCreditPackages();
      
      expect(packages).toHaveLength(3);
      expect(packages[0].name).toBe('Small Package');
      expect(packages[1].name).toBe('Medium Package');
      expect(packages[2].name).toBe('Large Package');
    });
  });

  describe('createBulkCreditPackage', () => {
    it('should create a new bulk credit package', async () => {
      const newPackage = await bulkPurchaseService.createBulkCreditPackage(
        'Test Package',
        'A test package',
        2000,
        15.0,
        'USD',
        15
      );
      
      expect(newPackage).toBeDefined();
      expect(newPackage.id).toBe('new-pkg');
      expect(newPackage.name).toBe('Test Package');
      expect(newPackage.creditAmount).toBe(2000);
      expect(newPackage.price).toBe(15.0);
      expect(newPackage.discountPercentage).toBe(15);
    });

    it('should throw error for invalid input', async () => {
      await expect(bulkPurchaseService.createBulkCreditPackage(
        '',
        'A test package',
        2000,
        15.0,
        'USD',
        15
      )).rejects.toThrow('Name is required');

      await expect(bulkPurchaseService.createBulkCreditPackage(
        'Test Package',
        'A test package',
        0,
        15.0,
        'USD',
        15
      )).rejects.toThrow('Credit amount must be positive');

      await expect(bulkPurchaseService.createBulkCreditPackage(
        'Test Package',
        'A test package',
        2000,
        0,
        'USD',
        15
      )).rejects.toThrow('Price must be positive');

      await expect(bulkPurchaseService.createBulkCreditPackage(
        'Test Package',
        'A test package',
        2000,
        15.0,
        'USD',
        101
      )).rejects.toThrow('Discount percentage must be between 0 and 100');
    });
  });

  describe('calculateCreditPrice', () => {
    it('should calculate price with no discount for small amount', async () => {
      const result = await bulkPurchaseService.calculateCreditPrice(500);
      
      expect(result.originalPrice).toBe(5); // 500 * 0.01
      expect(result.discountPercentage).toBe(0);
      expect(result.discountedPrice).toBe(5);
      expect(result.savings).toBe(0);
      expect(result.appliedPackage).toBeNull();
    });

    it('should calculate price with discount for medium amount', async () => {
      const result = await bulkPurchaseService.calculateCreditPrice(5000);
      
      expect(result.originalPrice).toBe(50); // 5000 * 0.01
      expect(result.discountPercentage).toBe(20);
      expect(result.discountedPrice).toBe(40); // 50 * 0.8
      expect(result.savings).toBe(10);
      expect(result.appliedPackage).toBeDefined();
      expect(result.appliedPackage?.id).toBe('pkg-2');
    });

    it('should calculate price with discount for large amount', async () => {
      const result = await bulkPurchaseService.calculateCreditPrice(10000);
      
      expect(result.originalPrice).toBe(100); // 10000 * 0.01
      expect(result.discountPercentage).toBe(30);
      expect(result.discountedPrice).toBe(70); // 100 * 0.7
      expect(result.savings).toBe(30);
      expect(result.appliedPackage).toBeDefined();
      expect(result.appliedPackage?.id).toBe('pkg-3');
    });
  });

  describe('purchaseCredits', () => {
    it('should purchase credits and add them to user account', async () => {
      const result = await bulkPurchaseService.purchaseCredits(
        'user-123',
        5000,
        'pm_card_visa'
      );
      
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.creditAmount).toBe(5000);
      expect(result.originalPrice).toBe(50);
      expect(result.discountedPrice).toBe(40);
      expect(result.discountPercentage).toBe(20);
      expect(result.savings).toBe(10);
      expect(result.paymentId).toBe('pm_123');
      expect(result.transactionId).toBe('tx-123');
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').getOrCreateCustomer)
        .toHaveBeenCalledWith('user-123');
      
      expect(require('../../services/payment/stripeService').createPayment)
        .toHaveBeenCalledWith(
          'cus_123',
          4000, // 40 * 100 cents
          'USD',
          'pm_card_visa',
          'Purchase of 5000 credits',
          expect.any(Object)
        );
      
      // Verify credits were added
      expect(require('../../models/userCredit.model').addCredits)
        .toHaveBeenCalledWith(
          'user-123',
          5000,
          'Purchased 5000 credits',
          'purchase',
          expect.objectContaining({
            paymentId: 'pm_123'
          })
        );
    });
  });

  describe('purchaseCreditPackage', () => {
    it('should purchase a specific credit package', async () => {
      const result = await bulkPurchaseService.purchaseCreditPackage(
        'user-123',
        'pkg-2',
        'pm_card_visa'
      );
      
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-123');
      expect(result.creditAmount).toBe(5000);
      expect(result.originalPrice).toBe(50); // 5000 * 0.01
      expect(result.discountedPrice).toBe(40);
      expect(result.discountPercentage).toBe(20);
      expect(result.savings).toBe(10);
      expect(result.paymentId).toBe('pm_123');
      expect(result.transactionId).toBe('tx-123');
      
      // Verify Stripe was called
      expect(require('../../services/payment/stripeService').getOrCreateCustomer)
        .toHaveBeenCalledWith('user-123');
      
      expect(require('../../services/payment/stripeService').createPayment)
        .toHaveBeenCalledWith(
          'cus_123',
          4000, // 40 * 100 cents
          'USD',
          'pm_card_visa',
          'Purchase of Medium Package credit package',
          expect.any(Object)
        );
      
      // Verify credits were added
      expect(require('../../models/userCredit.model').addCredits)
        .toHaveBeenCalledWith(
          'user-123',
          5000,
          'Purchased Medium Package credit package (5000 credits)',
          'purchase',
          expect.objectContaining({
            paymentId: 'pm_123',
            packageId: 'pkg-2'
          })
        );
    });

    it('should throw error for invalid package', async () => {
      await expect(bulkPurchaseService.purchaseCreditPackage(
        'user-123',
        'invalid-pkg',
        'pm_card_visa'
      )).rejects.toThrow('Invalid credit package');
    });
  });
});
