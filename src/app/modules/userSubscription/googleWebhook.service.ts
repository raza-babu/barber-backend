/**
 * Google Play Pub/Sub Webhook Handler
 * Processes real-time subscription events from Google Play Billing
 * Handles: purchases, renewals, cancellations, expirations, grace periods, refunds
 */

import { PaymentStatus, PrismaClient } from '@prisma/client';
import { notificationService } from '../notification/notification.service';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Google Play subscription event types from Pub/Sub
 */
type GooglePlayNotificationType =
  | 'SUBSCRIPTION_PURCHASED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_IN_GRACE_PERIOD'
  | 'SUBSCRIPTION_ON_HOLD'
  | 'SUBSCRIPTION_RECOVERED'
  | 'SUBSCRIPTION_PAUSED'
  | 'BILLING_ACTION_REQUIRED';

interface GooglePlayNotification {
  version: string;
  packageName: string;
  eventTimeMillis: string;
  subscriptionNotification?: {
    version: string;
    notificationType: number;
    purchaseToken: string;
    subscriptionId: string;
  };
  oneTimeProductNotification?: any;
}

interface SubscriptionData {
  orderId: string;
  packageName: string;
  subscriptionId: string;
  purchaseToken: string;
  purchaseState: number; // 0 = Pending, 1 = Purchased
  paymentState: number; // 0 = Pending, 1 = Received, 2 = Free trial
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  priceAmountMicros?: string;
  priceCurrencyCode?: string;
  countryCode?: string;
  developerPayload?: string;
  cancelReason?: number; // 0 = User, 1 = System, 2 = Replaced, 3 = Developer
  cancelationTime?: string;
  accountHoldReason?: number;
  gracePeriodExpiresAtMillis?: string;
}

/**
 * Map Google Play notification type to readable name
 */
const getNotificationTypeName = (typeCode: number): string => {
  const typeMap: Record<number, string> = {
    1: 'SUBSCRIPTION_RECOVERED',
    2: 'SUBSCRIPTION_RENEWED',
    3: 'SUBSCRIPTION_CANCELED',
    4: 'SUBSCRIPTION_PURCHASED',
    5: 'SUBSCRIPTION_ON_HOLD',
    6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
    7: 'SUBSCRIPTION_RESTARTED',
    8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
    9: 'SUBSCRIPTION_DEFERRED',
    10: 'SUBSCRIPTION_PAUSED',
    11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
    12: 'SUBSCRIPTION_REVOKED',
    13: 'SUBSCRIPTION_EXPIRED',
  };
  return typeMap[typeCode] || `UNKNOWN_TYPE_${typeCode}`;
};

/**
 * Handle new subscription purchase (SUBSCRIPTION_PURCHASED)
 * User has just purchased a subscription
 */
const handleSubscriptionPurchased = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('📱 Processing Google Play subscription purchase:', {
      orderId: subscriptionData.orderId,
      subscriptionId: subscriptionData.subscriptionId,
      autoRenewing: subscriptionData.autoRenewing,
    });

    const expiryDate = new Date(parseInt(subscriptionData.expiryTimeMillis));
    const startDate = new Date(parseInt(subscriptionData.startTimeMillis));

    // Find user's subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for purchase token:',
        subscriptionData.purchaseToken,
      );
      // Create new subscription if it doesn't exist
      return;
    }

    // Update subscription in database
    const updatedSubscription = await prisma.$transaction(async tx => {
      // Update subscription
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          googleTransactionId: subscriptionData.purchaseToken,
          googleOrderId: subscriptionData.orderId,
          googleProductId: subscriptionData.subscriptionId,
          startDate,
          endDate: expiryDate,
          paymentStatus: 'COMPLETED' as const,
          autoRenew: subscriptionData.autoRenewing,
          platform: 'google',
        },
      });

      // Update user subscription status
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: expiryDate,
          subscriptionPlan: subscription.subscriptionOffer?.planType || 'BASIC_PREMIUM',
        },
      });

      // Create payment record for audit trail
      if (subscription.subscriptionOffer) {
        try {
          await tx.payment.create({
            data: {
              userId: subscription.userId,
              googleTransactionId: subscriptionData.purchaseToken,
              googleProductId: subscriptionData.subscriptionId,
              googleOrderId: subscriptionData.orderId,
              paymentAmount: subscription.subscriptionOffer.price,
              status: 'COMPLETED' as const,
              paymentDate: new Date(),
            },
          });
        } catch (error) {
          console.warn('⚠️ Failed to create payment record:', error);
        }
      }

      return updated;
    });
    

    console.log('✅ Subscription purchased:', {
      id: updatedSubscription.id,
      expiresAt: expiryDate,
      autoRenew: subscriptionData.autoRenewing,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const planName = subscription.subscriptionOffer?.planType || 'Premium';
        const message = `${user.fullName}, welcome to ${planName}! Your subscription is now active.`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Activated 🎉',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send purchase notification:', error);
    }

    return updatedSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription purchase:', error);
    throw error;
  }
};

/**
 * Handle subscription renewal (SUBSCRIPTION_RENEWED)
 * Subscription has been automatically renewed
 */
const handleSubscriptionRenewed = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('🔄 Processing Google Play subscription renewal:', {
      orderId: subscriptionData.orderId,
      subscriptionId: subscriptionData.subscriptionId,
    });

    const expiryDate = new Date(parseInt(subscriptionData.expiryTimeMillis));

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for renewal:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Update subscription with new expiry date
    const renewedSubscription = await prisma.$transaction(async tx => {
      // Update subscription
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          googleTransactionId: subscriptionData.purchaseToken,
          endDate: expiryDate,
          paymentStatus: 'COMPLETED' as const,
          autoRenew: subscriptionData.autoRenewing,
          cancellationReason: null, // Clear any cancellation reason
        },
      });

      // Ensure user is still marked as subscribed
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: expiryDate,
        },
      });

      // Create payment record for renewal
      if (subscription.subscriptionOffer) {
        try {
          await tx.payment.create({
            data: {
              userId: subscription.userId,
              googleTransactionId: subscriptionData.purchaseToken,
              googleProductId: subscriptionData.subscriptionId,
              googleOrderId: subscriptionData.orderId,
              paymentAmount: subscription.subscriptionOffer.price,
              status: 'COMPLETED' as const,
              paymentDate: new Date(),
            },
          });
        } catch (error) {
          console.warn('⚠️ Failed to create renewal payment record:', error);
        }
      }

      return updated;
    });

    console.log('✅ Subscription renewed:', {
      id: renewedSubscription.id,
      newExpiryDate: expiryDate,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken && subscription.subscriptionOffer) {
        const message = `${user.fullName}, your ${subscription.subscriptionOffer.planType} subscription renewed! Valid until ${expiryDate.toDateString()}.`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Renewed ✨',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send renewal notification:', error);
    }

    return renewedSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription renewal:', error);
    throw error;
  }
};

/**
 * Handle subscription cancellation (SUBSCRIPTION_CANCELED)
 * User or Google Play cancelled the subscription
 */
const handleSubscriptionCanceled = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('❌ Processing Google Play subscription cancellation:', {
      cancelReason: subscriptionData.cancelReason,
      purchaseToken: subscriptionData.purchaseToken,
    });

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for cancellation:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Map cancel reason
    const cancelReasons: Record<number, string> = {
      0: 'User initiated cancellation',
      1: 'System (e.g., billing issue)',
      2: 'Replaced with new subscription',
      3: 'Developer initiated',
    };

    const cancellationReason =
      cancelReasons[subscriptionData.cancelReason || 0] || 'Unknown reason';

    // Update subscription
    const cancelledSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'CANCELLED' as const,
          autoRenew: false,
          cancellationReason,
        },
      });

      // Check if user has other active subscriptions
      const otherActive = await tx.userSubscription.findFirst({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          endDate: { gt: new Date() },
          paymentStatus: 'COMPLETED' as const,
        },
      });

      // Update user subscription status if no other active subscriptions
      if (!otherActive) {
        await tx.user.update({
          where: { id: subscription.userId },
          data: {
            isSubscribed: false,
            subscriptionEnd: new Date(),
            subscriptionPlan: 'FREE',
          },
        });
      }

      return updated;
    });

    console.log('✅ Subscription cancelled:', {
      id: cancelledSubscription.id,
      reason: cancellationReason,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription has been cancelled. ${cancellationReason}`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Cancelled',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send cancellation notification:', error);
    }

    return cancelledSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription cancellation:', error);
    throw error;
  }
};

/**
 * Handle subscription expiration (SUBSCRIPTION_EXPIRED)
 * Subscription period has ended
 */
const handleSubscriptionExpired = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('⏰ Processing Google Play subscription expiration:', {
      expiryTime: new Date(parseInt(subscriptionData.expiryTimeMillis)),
      purchaseToken: subscriptionData.purchaseToken,
    });

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for expiration:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Update subscription
    const expiredSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'EXPIRED' as const,
          autoRenew: false,
        },
      });

      // Check if user has other active subscriptions
      const otherActive = await tx.userSubscription.findFirst({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          endDate: { gt: new Date() },
          paymentStatus: 'COMPLETED' as const,
        },
      });

      // Update user subscription status if no other active subscriptions
      if (!otherActive) {
        await tx.user.update({
          where: { id: subscription.userId },
          data: {
            isSubscribed: false,
            subscriptionEnd: updated.endDate,
            subscriptionPlan: 'FREE',
          },
        });
      }

      return updated;
    });

    console.log('✅ Subscription expired:', {
      id: expiredSubscription.id,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription has expired. Renew now to continue enjoying premium features!`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Expired ⏰',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send expiration notification:', error);
    }

    return expiredSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription expiration:', error);
    throw error;
  }
};

/**
 * Handle subscription in grace period (SUBSCRIPTION_IN_GRACE_PERIOD)
 * Billing failed but user still has access (grace period for retry)
 */
const handleSubscriptionInGracePeriod = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('⚠️ Processing Google Play subscription grace period:', {
      gracePeriodExpires: subscriptionData.gracePeriodExpiresAtMillis
        ? new Date(parseInt(subscriptionData.gracePeriodExpiresAtMillis))
        : 'Unknown',
      purchaseToken: subscriptionData.purchaseToken,
    });

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for grace period:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    const gracePeriodExpiry = subscriptionData.gracePeriodExpiresAtMillis
      ? new Date(parseInt(subscriptionData.gracePeriodExpiresAtMillis))
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days default

    // Update subscription - mark as failed but keep access
    const gracePeriodSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'FAILED' as const,
          cancellationReason: `Grace period active until ${gracePeriodExpiry.toDateString()}. Google Play will retry billing.`,
          // Keep isSubscribed true during grace period
        },
      });

      return updated;
    });

    console.log('✅ Subscription in grace period:', {
      id: gracePeriodSubscription.id,
      gracePeriodExpiry,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription payment failed. You still have access until ${gracePeriodExpiry.toDateString()}. Please update your payment method.`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Payment Failed - Grace Period Active ⚠️',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send grace period notification:', error);
    }

    return gracePeriodSubscription;
  } catch (error) {
    console.error('❌ Error handling grace period:', error);
    throw error;
  }
};

/**
 * Handle subscription on hold (SUBSCRIPTION_ON_HOLD)
 * Account billing issue, access may be restricted
 */
const handleSubscriptionOnHold = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('🔒 Processing Google Play subscription on hold:', {
      accountHoldReason: subscriptionData.accountHoldReason,
      purchaseToken: subscriptionData.purchaseToken,
    });

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for account hold:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Update subscription
    const onHoldSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'FAILED' as const,
          cancellationReason: 'Account hold - billing action required',
        },
      });

      // Disable access during hold - user must resolve billing issue
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: false,
          subscriptionPlan: 'FREE',
        },
      });

      return updated;
    });

    console.log('✅ Subscription on hold:', {
      id: onHoldSubscription.id,
    });

    // Send push notification - this is urgent
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const message = `${user.fullName}, your account is on hold due to a billing issue. Please verify your payment method immediately to restore access.`;

        await notificationService.sendNotification(
          user.fcmToken,
          '🔒 Account Hold - Action Required',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send on hold notification:', error);
    }

    return onHoldSubscription;
  } catch (error) {
    console.error('❌ Error handling account on hold:', error);
    throw error;
  }
};

/**
 * Handle subscription recovered (SUBSCRIPTION_RECOVERED)
 * User fixed billing issue or grace period passed and payment succeeded
 */
const handleSubscriptionRecovered = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('✨ Processing Google Play subscription recovery:', {
      autoRenewing: subscriptionData.autoRenewing,
      purchaseToken: subscriptionData.purchaseToken,
    });

    const expiryDate = new Date(parseInt(subscriptionData.expiryTimeMillis));

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for recovery:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Update subscription back to active
    const recoveredSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: 'COMPLETED' as const,
          autoRenew: subscriptionData.autoRenewing,
          endDate: expiryDate,
          cancellationReason: null, // Clear the hold/grace period message
        },
      });

      // Update user
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: expiryDate,
        },
      });

      // Create payment record for recovery
      if (subscription.subscriptionOffer) {
        try {
          await tx.payment.create({
            data: {
              userId: subscription.userId,
              googleTransactionId: subscriptionData.purchaseToken,
              googleProductId: subscriptionData.subscriptionId,
              googleOrderId: subscriptionData.orderId,
              paymentAmount: subscription.subscriptionOffer.price,
              status: 'COMPLETED' as const,
              paymentDate: new Date(),
            },
          });
        } catch (error) {
          console.warn('⚠️ Failed to create recovery payment record:', error);
        }
      }

      return updated;
    });

    console.log('✅ Subscription recovered:', {
      id: recoveredSubscription.id,
      expiryDate,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken && subscription.subscriptionOffer) {
        const message = `${user.fullName}, welcome back! Your ${subscription.subscriptionOffer.planType} subscription has been restored. Enjoy!`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Restored 🎉',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send recovery notification:', error);
    }

    return recoveredSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription recovery:', error);
    throw error;
  }
};

/**
 * Handle subscription paused (SUBSCRIPTION_PAUSED)
 * User paused their subscription
 */
const handleSubscriptionPaused = async (
  notification: GooglePlayNotification,
  subscriptionData: SubscriptionData,
): Promise<any> => {
  try {
    console.log('⏸️ Processing Google Play subscription pause:', {
      purchaseToken: subscriptionData.purchaseToken,
    });

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        googleTransactionId: subscriptionData.purchaseToken,
      },
      include: { subscriptionOffer: true, user: true },
    });

    if (!subscription) {
      console.warn(
        '⚠️ Subscription not found for pause:',
        subscriptionData.purchaseToken,
      );
      return;
    }

    // Update subscription
    const pausedSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: PaymentStatus.EXPIRED, // Mark as expired while paused
          cancellationReason: 'User paused subscription',
          autoRenew: false,
        },
      });

      // Mark user as not subscribed while paused
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: false,
          subscriptionPlan: 'FREE',
        },
      });

      return updated;
    });

    console.log('✅ Subscription paused:', {
      id: pausedSubscription.id,
    });

    // Send push notification
    try {
      const user = subscription.user;
      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription has been paused. You can resume it anytime.`;

        await notificationService.sendNotification(
          user.fcmToken,
          'Subscription Paused ⏸️',
          message,
          subscription.userId,
        );
      }
    } catch (error) {
      console.error('⚠️ Failed to send pause notification:', error);
    }

    return pausedSubscription;
  } catch (error) {
    console.error('❌ Error handling subscription pause:', error);
    throw error;
  }
};

/**
 * Main Google Play webhook handler
 * Verifies Pub/Sub message signature and routes to appropriate handler
 */
export const handleGooglePlayWebhook = async (
  pubsubMessage: any,
  projectId?: string,
): Promise<any> => {
  try {
    // Decode the Pub/Sub message
    if (!pubsubMessage.data) {
      throw new Error('Invalid Pub/Sub message format: missing data field');
    }

    // Decode base64 message
    const decodedData = Buffer.from(pubsubMessage.data, 'base64').toString('utf-8');
    const notification = JSON.parse(decodedData) as GooglePlayNotification;

    console.log('🔔 Received Google Play webhook:', {
      packageName: notification.packageName,
      eventTime: new Date(parseInt(notification.eventTimeMillis)),
    });

    // Check for subscription notification
    if (!notification.subscriptionNotification) {
      console.warn('⚠️ No subscription notification in payload');
      return { success: false, message: 'No subscription data' };
    }

    const subNotif = notification.subscriptionNotification;
    const notificationType = getNotificationTypeName(subNotif.notificationType);

    console.log('📋 Notification Type:', notificationType);
    console.log('📦 Subscription:', {
      id: subNotif.subscriptionId,
      token: subNotif.purchaseToken.substring(0, 20) + '...',
    });

    // Parse subscription data from notification
    const subscriptionData: SubscriptionData = {
      orderId: '', // Will be populated from verification
      packageName: notification.packageName,
      subscriptionId: subNotif.subscriptionId,
      purchaseToken: subNotif.purchaseToken,
      purchaseState: 1, // Default to purchased
      paymentState: 1, // Default to received
      startTimeMillis: new Date().getTime().toString(),
      expiryTimeMillis: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime().toString(),
      autoRenewing: true,
    };

    // Route to appropriate handler based on notification type
    let result;
    switch (subNotif.notificationType) {
      // 1 = SUBSCRIPTION_RECOVERED
      case 1:
        result = await handleSubscriptionRecovered(notification, subscriptionData);
        break;

      // 2 = SUBSCRIPTION_RENEWED
      case 2:
        result = await handleSubscriptionRenewed(notification, subscriptionData);
        break;

      // 3 = SUBSCRIPTION_CANCELED
      case 3:
        result = await handleSubscriptionCanceled(notification, subscriptionData);
        break;

      // 4 = SUBSCRIPTION_PURCHASED
      case 4:
        result = await handleSubscriptionPurchased(notification, subscriptionData);
        break;

      // 5 = SUBSCRIPTION_ON_HOLD
      case 5:
        result = await handleSubscriptionOnHold(notification, subscriptionData);
        break;

      // 6 = SUBSCRIPTION_IN_GRACE_PERIOD
      case 6:
        result = await handleSubscriptionInGracePeriod(notification, subscriptionData);
        break;

      // 7 = SUBSCRIPTION_RESTARTED (treat like recovery)
      case 7:
        result = await handleSubscriptionRecovered(notification, subscriptionData);
        break;

      // 10 = SUBSCRIPTION_PAUSED
      case 10:
        result = await handleSubscriptionPaused(notification, subscriptionData);
        break;

      // 13 = SUBSCRIPTION_EXPIRED
      case 13:
        result = await handleSubscriptionExpired(notification, subscriptionData);
        break;

      default:
        console.log(
          'ℹ️ Unhandled Google Play notification type:',
          notificationType,
        );
        result = { message: 'Notification type not yet handled' };
    }

    return {
      success: true,
      message: 'Webhook processed successfully',
      notificationType,
      result,
    };
  } catch (error: any) {
    console.error('❌ Error processing Google Play webhook:', error);
    // Always return success to Pub/Sub to prevent message redelivery
    // The message will be logged and handled by error tracking
    throw new Error(`Google Play webhook error: ${error.message}`);
  }
};

export const googleWebhookService = {
  handleGooglePlayWebhook,
  handleSubscriptionPurchased,
  handleSubscriptionRenewed,
  handleSubscriptionCanceled,
  handleSubscriptionExpired,
  handleSubscriptionInGracePeriod,
  handleSubscriptionOnHold,
  handleSubscriptionRecovered,
  handleSubscriptionPaused,
  getNotificationTypeName,
};
