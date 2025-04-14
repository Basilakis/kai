/**
 * Webhook Controller
 *
 * This controller handles webhook events from external services like Stripe.
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import stripeService from '../services/payment/stripeService';
import { supabaseClient } from '../services/supabase/supabaseClient';
import { messageBrokerFactory } from '../services/messaging/messageBrokerFactory';
import { MessageType } from '../services/messaging/messageBrokerInterface';
import {
  getUserSubscription,
  updateUserSubscription,
  getSubscriptionTierById
} from '../models/userSubscription.model';
import {
  addCredits,
  initializeUserCredit
} from '../models/userCredit.model';
import creditService from '../services/credit/creditService';

/**
 * Handle Stripe webhook events
 * @route POST /api/webhooks/stripe
 * @access Public
 */
export const handleStripeWebhook = async (req: Request, res: Response) => {
  try {
    // Verify Stripe webhook signature
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      logger.warn('Missing Stripe signature');
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    // Construct event from payload and signature
    const event = stripeService.constructEventFromWebhook(req.body, signature);

    logger.info(`Received Stripe webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.created':
        logger.info(`Stripe customer created: ${event.data.object.id}`);
        break;

      case 'payment_method.attached':
        logger.info(`Payment method attached: ${event.data.object.id}`);
        break;

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        logger.warn(`Payment intent failed: ${event.data.object.id}`);
        break;

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error(`Error handling Stripe webhook: ${error}`);
    return res.status(400).json({ error: 'Webhook error' });
  }
};

/**
 * Handle subscription created event
 * @param subscription Stripe subscription object
 */
async function handleSubscriptionCreated(subscription: any) {
  try {
    const { metadata } = subscription;

    // Check if metadata contains userId
    if (!metadata || !metadata.userId) {
      logger.warn(`Subscription created without userId metadata: ${subscription.id}`);
      return;
    }

    const userId = metadata.userId;

    // Get user subscription
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
      logger.warn(`User subscription not found for userId: ${userId}`);
      return;
    }

    // Update subscription with Stripe data
    await updateUserSubscription(userSubscription.id, {
      status: subscription.status,
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      autoRenew: !subscription.cancel_at_period_end
    });

    // Get subscription tier to check included credits
    const tier = await getSubscriptionTierById(userSubscription.tierId);

    if (tier && tier.creditLimits && tier.creditLimits.includedCredits > 0) {
      // Initialize user credit if it doesn't exist
      await creditService.initializeUserCredit(userId);

      // Add included credits from subscription tier
      await creditService.addCreditsToUser(
        userId,
        tier.creditLimits.includedCredits,
        `Credits included with ${tier.name} subscription`,
        'subscription',
        { subscriptionId: userSubscription.id, tierId: tier.id }
      );

      logger.info(`Added ${tier.creditLimits.includedCredits} credits to user ${userId} from subscription tier ${tier.name}`);
    }

    logger.info(`Updated user subscription for userId: ${userId} with Stripe subscription: ${subscription.id}`);
  } catch (error) {
    logger.error(`Error handling subscription created: ${error}`);
  }
}

/**
 * Handle subscription updated event
 * @param subscription Stripe subscription object
 */
async function handleSubscriptionUpdated(subscription: any) {
  try {
    // Find user subscription by Stripe subscription ID
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('stripeSubscriptionId', subscription.id)
      .single();

    if (error || !data) {
      logger.warn(`User subscription not found for Stripe subscription: ${subscription.id}`);
      return;
    }

    // Update subscription with Stripe data
    await updateUserSubscription(data.id, {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      autoRenew: !subscription.cancel_at_period_end
    });

    logger.info(`Updated user subscription for Stripe subscription: ${subscription.id}`);
  } catch (error) {
    logger.error(`Error handling subscription updated: ${error}`);
  }
}

/**
 * Handle subscription deleted event
 * @param subscription Stripe subscription object
 */
async function handleSubscriptionDeleted(subscription: any) {
  try {
    // Find user subscription by Stripe subscription ID
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('stripeSubscriptionId', subscription.id)
      .single();

    if (error || !data) {
      logger.warn(`User subscription not found for Stripe subscription: ${subscription.id}`);
      return;
    }

    // Update subscription with Stripe data
    await updateUserSubscription(data.id, {
      status: 'canceled',
      endDate: new Date(),
      canceledAt: new Date(),
      autoRenew: false
    });

    logger.info(`Marked user subscription as canceled for Stripe subscription: ${subscription.id}`);
  } catch (error) {
    logger.error(`Error handling subscription deleted: ${error}`);
  }
}

/**
 * Handle invoice payment succeeded event
 * @param invoice Stripe invoice object
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
  try {
    // Check if this is a subscription invoice
    if (!invoice.subscription) {
      // This might be a one-time payment for credits
      if (invoice.metadata && invoice.metadata.type === 'credits' && invoice.metadata.userId) {
        await handleCreditPurchase(invoice);
      }
      return;
    }

    // Find user subscription by Stripe subscription ID
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('stripeSubscriptionId', invoice.subscription)
      .single();

    if (error || !data) {
      logger.warn(`User subscription not found for Stripe subscription: ${invoice.subscription}`);
      return;
    }

    // Update subscription status to active if it was past_due or incomplete
    if (data.status === 'past_due' || data.status === 'incomplete') {
      await updateUserSubscription(data.id, {
        status: 'active'
      });

      logger.info(`Updated user subscription status to active for Stripe subscription: ${invoice.subscription}`);
    }

    // If this is a subscription with credits included, add them to the user
    if (invoice.metadata && invoice.metadata.includeCredits && invoice.metadata.creditAmount) {
      const creditAmount = parseInt(invoice.metadata.creditAmount, 10);

      if (creditAmount > 0) {
        // Initialize user credit if it doesn't exist
        await initializeUserCredit(data.userId);

        // Add credits to user
        await addCredits(
          data.userId,
          creditAmount,
          `Credits from subscription payment (Invoice: ${invoice.id})`,
          'subscription',
          { invoiceId: invoice.id, subscriptionId: invoice.subscription }
        );

        logger.info(`Added ${creditAmount} credits to user ${data.userId} from subscription payment`);
      }
    }
  } catch (error) {
    logger.error(`Error handling invoice payment succeeded: ${error}`);
  }
}

/**
 * Handle invoice payment failed event
 * @param invoice Stripe invoice object
 */
async function handleInvoicePaymentFailed(invoice: any) {
  try {
    // Check if this is a subscription invoice
    if (!invoice.subscription) {
      return;
    }

    // Find user subscription by Stripe subscription ID
    const { data, error } = await (supabaseClient.getClient()
      .from('user_subscriptions') as any)
      .select('*')
      .eq('stripeSubscriptionId', invoice.subscription)
      .single();

    if (error || !data) {
      logger.warn(`User subscription not found for Stripe subscription: ${invoice.subscription}`);
      return;
    }

    // Update subscription status to past_due
    await updateUserSubscription(data.id, {
      status: 'past_due'
    });

    logger.info(`Updated user subscription status to past_due for Stripe subscription: ${invoice.subscription}`);

    // Send notification to user about failed payment
    try {
      const broker = messageBrokerFactory.getDefaultBroker();

      await broker.publish(
        'system',
        MessageType.USER_NOTIFICATION,
        {
          userId: data.userId,
          title: 'Payment Failed',
          message: 'Your subscription payment has failed. Please update your payment method to avoid service interruption.',
          type: 'error',
          actionUrl: '/subscription/payment-methods',
          metadata: {
            invoiceId: invoice.id,
            subscriptionId: invoice.subscription,
            failureReason: invoice.last_payment_error?.message || 'Payment processing failed'
          }
        },
        'webhook-controller'
      );

      logger.info(`Sent payment failure notification to user ${data.userId}`);
    } catch (notificationError) {
      logger.error(`Failed to send payment failure notification: ${notificationError}`);
    }
  } catch (error) {
    logger.error(`Error handling invoice payment failed: ${error}`);
  }
}

/**
 * Handle payment intent succeeded event
 * @param paymentIntent Stripe payment intent object
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  try {
    // Check if this is a credit purchase
    if (paymentIntent.metadata && paymentIntent.metadata.type === 'credits' && paymentIntent.metadata.userId) {
      await handleCreditPurchase(paymentIntent);
    }
  } catch (error) {
    logger.error(`Error handling payment intent succeeded: ${error}`);
  }
}

/**
 * Handle credit purchase
 * @param payment Stripe payment object (invoice or payment intent)
 */
async function handleCreditPurchase(payment: any) {
  try {
    const userId = payment.metadata.userId;
    const creditAmount = parseInt(payment.metadata.creditAmount, 10);

    if (!userId || isNaN(creditAmount) || creditAmount <= 0) {
      logger.warn(`Invalid credit purchase metadata: ${JSON.stringify(payment.metadata)}`);
      return;
    }

    // Initialize user credit if it doesn't exist
    await initializeUserCredit(userId);

    // Add credits to user
    await addCredits(
      userId,
      creditAmount,
      `Credit purchase (${payment.id})`,
      'purchase',
      { paymentId: payment.id, amount: payment.amount }
    );

    logger.info(`Added ${creditAmount} credits to user ${userId} from purchase`);
  } catch (error) {
    logger.error(`Error handling credit purchase: ${error}`);
  }
}

export default {
  handleStripeWebhook
};
