/**
 * Stripe Payment Service
 * 
 * This service handles all interactions with the Stripe API for payment processing,
 * subscription management, and customer management.
 */

import Stripe from 'stripe';
import { logger } from '../../utils/logger';

// Initialize Stripe with API key from environment variables
const stripeApiKey = process.env.STRIPE_SECRET_KEY || '';
const stripeApiVersion = process.env.STRIPE_API_VERSION || '2023-10-16';
const isTestMode = process.env.STRIPE_TEST_MODE === 'true';

if (!stripeApiKey) {
  logger.warn('Stripe API key is not set. Payment features will not work.');
}

// Create Stripe instance
const stripe = new Stripe(stripeApiKey, {
  apiVersion: stripeApiVersion as Stripe.LatestApiVersion,
  typescript: true,
});

/**
 * Customer Management
 */

/**
 * Create a new Stripe customer
 * @param email Customer email
 * @param name Customer name
 * @param metadata Additional metadata
 * @returns Stripe customer object
 */
export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });
    
    logger.info(`Created Stripe customer: ${customer.id} for email: ${email}`);
    return customer;
  } catch (error) {
    logger.error(`Failed to create Stripe customer: ${error}`);
    throw error;
  }
}

/**
 * Retrieve a Stripe customer by ID
 * @param customerId Stripe customer ID
 * @returns Stripe customer object
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    return customer;
  } catch (error) {
    logger.error(`Failed to retrieve Stripe customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Update a Stripe customer
 * @param customerId Stripe customer ID
 * @param updateData Data to update
 * @returns Updated Stripe customer object
 */
export async function updateCustomer(
  customerId: string,
  updateData: Stripe.CustomerUpdateParams
): Promise<Stripe.Customer> {
  try {
    const customer = await stripe.customers.update(customerId, updateData);
    logger.info(`Updated Stripe customer: ${customerId}`);
    return customer;
  } catch (error) {
    logger.error(`Failed to update Stripe customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Delete a Stripe customer
 * @param customerId Stripe customer ID
 * @returns Deletion confirmation
 */
export async function deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
  try {
    const deleted = await stripe.customers.del(customerId);
    logger.info(`Deleted Stripe customer: ${customerId}`);
    return deleted;
  } catch (error) {
    logger.error(`Failed to delete Stripe customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Payment Method Management
 */

/**
 * Add a payment method to a customer
 * @param customerId Stripe customer ID
 * @param paymentMethodId Stripe payment method ID
 * @param setAsDefault Whether to set as default payment method
 * @returns Attached payment method
 */
export async function attachPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  setAsDefault: boolean = true
): Promise<Stripe.PaymentMethod> {
  try {
    // Attach payment method to customer
    const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method if requested
    if (setAsDefault) {
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    }
    
    logger.info(`Attached payment method ${paymentMethodId} to customer ${customerId}`);
    return paymentMethod;
  } catch (error) {
    logger.error(`Failed to attach payment method ${paymentMethodId} to customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * List payment methods for a customer
 * @param customerId Stripe customer ID
 * @param type Payment method type
 * @returns List of payment methods
 */
export async function listPaymentMethods(
  customerId: string,
  type: Stripe.PaymentMethodListParams.Type = 'card'
): Promise<Stripe.PaymentMethod[]> {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type,
    });
    
    return paymentMethods.data;
  } catch (error) {
    logger.error(`Failed to list payment methods for customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Detach a payment method from a customer
 * @param paymentMethodId Stripe payment method ID
 * @returns Detached payment method
 */
export async function detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
  try {
    const paymentMethod = await stripe.paymentMethods.detach(paymentMethodId);
    logger.info(`Detached payment method: ${paymentMethodId}`);
    return paymentMethod;
  } catch (error) {
    logger.error(`Failed to detach payment method ${paymentMethodId}: ${error}`);
    throw error;
  }
}

/**
 * Product and Price Management
 */

/**
 * Create a new product in Stripe
 * @param name Product name
 * @param description Product description
 * @param metadata Additional metadata
 * @returns Stripe product object
 */
export async function createProduct(
  name: string,
  description?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Product> {
  try {
    const product = await stripe.products.create({
      name,
      description,
      metadata,
    });
    
    logger.info(`Created Stripe product: ${product.id} - ${name}`);
    return product;
  } catch (error) {
    logger.error(`Failed to create Stripe product: ${error}`);
    throw error;
  }
}

/**
 * Create a new price for a product
 * @param productId Stripe product ID
 * @param unitAmount Price in smallest currency unit (e.g., cents)
 * @param currency Currency code (e.g., 'usd')
 * @param recurring Recurring billing configuration
 * @param metadata Additional metadata
 * @returns Stripe price object
 */
export async function createPrice(
  productId: string,
  unitAmount: number,
  currency: string = 'usd',
  recurring?: Stripe.PriceCreateParams.Recurring,
  metadata?: Record<string, string>
): Promise<Stripe.Price> {
  try {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: unitAmount,
      currency,
      recurring,
      metadata,
    });
    
    logger.info(`Created Stripe price: ${price.id} for product: ${productId}`);
    return price;
  } catch (error) {
    logger.error(`Failed to create Stripe price: ${error}`);
    throw error;
  }
}

/**
 * Subscription Management
 */

/**
 * Create a subscription for a customer
 * @param customerId Stripe customer ID
 * @param priceId Stripe price ID
 * @param options Subscription options
 * @returns Stripe subscription object
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  options: {
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
    cancelAtPeriodEnd?: boolean;
    paymentBehavior?: 'default_incomplete' | 'error_if_incomplete' | 'pending_if_incomplete';
  } = {}
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      trial_period_days: options.trialPeriodDays,
      metadata: options.metadata,
      cancel_at_period_end: options.cancelAtPeriodEnd,
      payment_behavior: options.paymentBehavior,
      expand: ['latest_invoice.payment_intent'],
    });
    
    logger.info(`Created subscription ${subscription.id} for customer ${customerId} with price ${priceId}`);
    return subscription;
  } catch (error) {
    logger.error(`Failed to create subscription for customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Retrieve a subscription
 * @param subscriptionId Stripe subscription ID
 * @returns Stripe subscription object
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error(`Failed to retrieve subscription ${subscriptionId}: ${error}`);
    throw error;
  }
}

/**
 * Update a subscription
 * @param subscriptionId Stripe subscription ID
 * @param updateData Data to update
 * @returns Updated Stripe subscription object
 */
export async function updateSubscription(
  subscriptionId: string,
  updateData: Stripe.SubscriptionUpdateParams
): Promise<Stripe.Subscription> {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
    logger.info(`Updated subscription: ${subscriptionId}`);
    return subscription;
  } catch (error) {
    logger.error(`Failed to update subscription ${subscriptionId}: ${error}`);
    throw error;
  }
}

/**
 * Cancel a subscription
 * @param subscriptionId Stripe subscription ID
 * @param cancelAtPeriodEnd Whether to cancel at period end
 * @returns Canceled Stripe subscription object
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  try {
    let subscription;
    
    if (cancelAtPeriodEnd) {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      logger.info(`Subscription ${subscriptionId} will be canceled at period end`);
    } else {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
      logger.info(`Subscription ${subscriptionId} canceled immediately`);
    }
    
    return subscription;
  } catch (error) {
    logger.error(`Failed to cancel subscription ${subscriptionId}: ${error}`);
    throw error;
  }
}

/**
 * Change subscription plan
 * @param subscriptionId Stripe subscription ID
 * @param newPriceId New Stripe price ID
 * @param options Change options
 * @returns Updated Stripe subscription object
 */
export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string,
  options: {
    prorationDate?: number;
    prorate?: boolean;
  } = {}
): Promise<Stripe.Subscription> {
  try {
    // Get the subscription to find the current item ID
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0].id;
    
    // Update the subscription with the new price
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      proration_date: options.prorationDate,
      proration_behavior: options.prorate ? 'create_prorations' : 'none',
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
    });
    
    logger.info(`Changed subscription ${subscriptionId} to price ${newPriceId}`);
    return updatedSubscription;
  } catch (error) {
    logger.error(`Failed to change subscription ${subscriptionId} to price ${newPriceId}: ${error}`);
    throw error;
  }
}

/**
 * Invoice Management
 */

/**
 * Create an invoice for a customer
 * @param customerId Stripe customer ID
 * @param options Invoice options
 * @returns Stripe invoice object
 */
export async function createInvoice(
  customerId: string,
  options: {
    description?: string;
    metadata?: Record<string, string>;
    autoAdvance?: boolean;
  } = {}
): Promise<Stripe.Invoice> {
  try {
    const invoice = await stripe.invoices.create({
      customer: customerId,
      description: options.description,
      metadata: options.metadata,
      auto_advance: options.autoAdvance,
    });
    
    logger.info(`Created invoice ${invoice.id} for customer ${customerId}`);
    return invoice;
  } catch (error) {
    logger.error(`Failed to create invoice for customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Add an invoice item to a customer
 * @param customerId Stripe customer ID
 * @param amount Amount in smallest currency unit (e.g., cents)
 * @param currency Currency code (e.g., 'usd')
 * @param description Item description
 * @param metadata Additional metadata
 * @returns Stripe invoice item object
 */
export async function addInvoiceItem(
  customerId: string,
  amount: number,
  currency: string = 'usd',
  description?: string,
  metadata?: Record<string, string>
): Promise<Stripe.InvoiceItem> {
  try {
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      amount,
      currency,
      description,
      metadata,
    });
    
    logger.info(`Added invoice item ${invoiceItem.id} for customer ${customerId}`);
    return invoiceItem;
  } catch (error) {
    logger.error(`Failed to add invoice item for customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Finalize an invoice
 * @param invoiceId Stripe invoice ID
 * @returns Finalized Stripe invoice object
 */
export async function finalizeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  try {
    const invoice = await stripe.invoices.finalizeInvoice(invoiceId);
    logger.info(`Finalized invoice: ${invoiceId}`);
    return invoice;
  } catch (error) {
    logger.error(`Failed to finalize invoice ${invoiceId}: ${error}`);
    throw error;
  }
}

/**
 * Pay an invoice
 * @param invoiceId Stripe invoice ID
 * @returns Paid Stripe invoice object
 */
export async function payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  try {
    const invoice = await stripe.invoices.pay(invoiceId);
    logger.info(`Paid invoice: ${invoiceId}`);
    return invoice;
  } catch (error) {
    logger.error(`Failed to pay invoice ${invoiceId}: ${error}`);
    throw error;
  }
}

/**
 * Credit Management
 */

/**
 * Add credits to a customer
 * @param customerId Stripe customer ID
 * @param amount Amount of credits to add
 * @param metadata Additional metadata
 * @returns Stripe customer balance transaction object
 */
export async function addCredits(
  customerId: string,
  amount: number,
  metadata?: Record<string, string>
): Promise<Stripe.CustomerBalanceTransaction> {
  try {
    // Amount is in cents, negative means adding credits
    const balanceTransaction = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -amount, // Negative amount adds to customer balance
      currency: 'usd',
      description: `Added ${amount / 100} credits`,
      metadata,
    });
    
    logger.info(`Added ${amount / 100} credits to customer ${customerId}`);
    return balanceTransaction;
  } catch (error) {
    logger.error(`Failed to add credits to customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Use credits from a customer
 * @param customerId Stripe customer ID
 * @param amount Amount of credits to use
 * @param metadata Additional metadata
 * @returns Stripe customer balance transaction object
 */
export async function useCredits(
  customerId: string,
  amount: number,
  metadata?: Record<string, string>
): Promise<Stripe.CustomerBalanceTransaction> {
  try {
    // Amount is in cents, positive means using credits
    const balanceTransaction = await stripe.customers.createBalanceTransaction(customerId, {
      amount: amount, // Positive amount reduces customer balance
      currency: 'usd',
      description: `Used ${amount / 100} credits`,
      metadata,
    });
    
    logger.info(`Used ${amount / 100} credits from customer ${customerId}`);
    return balanceTransaction;
  } catch (error) {
    logger.error(`Failed to use credits from customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Get customer balance
 * @param customerId Stripe customer ID
 * @returns Customer balance in cents
 */
export async function getCustomerBalance(customerId: string): Promise<number> {
  try {
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    return customer.balance;
  } catch (error) {
    logger.error(`Failed to get balance for customer ${customerId}: ${error}`);
    throw error;
  }
}

/**
 * Webhook Handling
 */

/**
 * Construct Stripe event from webhook payload
 * @param payload Webhook payload
 * @param signature Stripe signature
 * @returns Stripe event object
 */
export function constructEventFromWebhook(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret is not set');
    }
    
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    logger.error(`Failed to construct Stripe event from webhook: ${error}`);
    throw error;
  }
}

/**
 * Utility Functions
 */

/**
 * Check if Stripe is properly configured
 * @returns Whether Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return !!stripeApiKey;
}

/**
 * Get Stripe test mode status
 * @returns Whether Stripe is in test mode
 */
export function isStripeTestMode(): boolean {
  return isTestMode;
}

export default {
  // Customer Management
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  
  // Payment Method Management
  attachPaymentMethod,
  listPaymentMethods,
  detachPaymentMethod,
  
  // Product and Price Management
  createProduct,
  createPrice,
  
  // Subscription Management
  createSubscription,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  
  // Invoice Management
  createInvoice,
  addInvoiceItem,
  finalizeInvoice,
  payInvoice,
  
  // Credit Management
  addCredits,
  useCredits,
  getCustomerBalance,
  
  // Webhook Handling
  constructEventFromWebhook,
  
  // Utility Functions
  isStripeConfigured,
  isStripeTestMode,
  
  // Raw Stripe instance for advanced usage
  stripe,
};
