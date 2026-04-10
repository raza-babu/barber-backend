import prisma from '../../utils/prisma';
import { PaymentStatus, SubscriptionPlanStatus } from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import { appleIAPService } from './appleIAP.service';
import { notificationService } from '../notification/notification.service';

/**
 * Apple Server-to-Server Notification Handler
 * Processes webhooks from Apple's App Store Server Notifications API
 */

interface AppleNotificationPayload {
  notificationType: string;
  subtype?: string;
  data: {
    transactionId: string;
    originalTransactionId: string;
    bundleId: string;
    productId: string;
    expiresDate?: string;
    purchaseDate?: string;
  };
  signedDate: string;
}

/**
 * Handle new subscription (SUBSCRIBED notification)
 * User has just subscribed or auto-renewal started
 */
const handleSubscribedNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing subscription notification:', notification);

    const { data } = notification;

    // Find subscription by transaction ID
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        appleTransactionId: data.transactionId,
      },
      include: { subscriptionOffer: true },
    });

    if (!subscription) {
      console.warn(
        'Subscription not found for SUBSCRIBED:',
        data.transactionId,
      );
      return;
    }

    // Update user and subscription
    const updatedData = await prisma.$transaction(async tx => {
      // Update subscription
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: PaymentStatus.COMPLETED,
          autoRenew: true,
          endDate: new Date(
            parseInt(data.expiresDate || '') ||
              Date.now() + 30 * 24 * 60 * 60 * 1000,
          ),
        },
      });

      // Update user - set isSubscribed to true
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: updated.endDate,
          subscriptionPlan: subscription.subscriptionOffer
            ? subscription.subscriptionOffer.planType
            : 'FREE',
        },
      });

      return updated;
    });

    console.log('✅ User subscribed:', updatedData.id);
    
    // Send push notification to user about subscription
    try {
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { fcmToken: true, fullName: true },
      });

      if (user?.fcmToken && subscription.subscriptionOffer) {
        const message = `${user.fullName}, your ${subscription.subscriptionOffer.planType} subscription has been activated successfully!`;
        
        await notificationService
          .sendNotification(
            user.fcmToken,
            'Subscription Activated',
            message,
            subscription.userId,
          )
          .catch(error =>
            console.error('Error sending subscription activation webhook notification:', error),
          );
      }
    } catch (error) {
      console.error('Error sending subscription activation webhook notification:', error);
    }
    
    return updatedData;
  } catch (error) {
    console.error('Error handling subscription notification:', error);
    throw error;
  }
};

/**
 * Handle Apple renewal notification
 * Subscription has been renewed and is still active (DID_RENEW)
 */
const handleRenewalNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing renewal notification:', notification);

    const { data } = notification;

    // Find subscription by original transaction ID
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        appleOriginalTransactionId: data.originalTransactionId,
      },
      include: { subscriptionOffer: true },
    });

    if (!subscription) {
      console.warn(
        'Subscription not found for renewal:',
        data.originalTransactionId,
      );
      return;
    }

    // Update subscription with new transaction ID
    const updatedSubscription = await prisma.$transaction(async tx => {
      // Update subscription record
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          appleTransactionId: data.transactionId,
          appleProductId: data.productId,
          endDate: new Date(
            parseInt(data.expiresDate || '') ||
              Date.now() + 30 * 24 * 60 * 60 * 1000,
          ),
          paymentStatus: PaymentStatus.COMPLETED,
          autoRenew: true, // Still auto-renewing
        },
      });

      // Update user - ensure isSubscribed is true
      await tx.user.update({
        where: { id: subscription.userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: updated.endDate,
        },
      });

      // Create payment record for renewal
      if (subscription.subscriptionOffer) {
        await tx.payment.create({
          data: {
            userId: subscription.userId,
            appleTransactionId: data.transactionId,
            appleProductId: data.productId,
            paymentAmount: subscription.subscriptionOffer.price,
            status: PaymentStatus.COMPLETED,
          },
        });
      }

      return updated;
    });

    console.log('✅ Subscription renewed:', updatedSubscription.id);
    
    // Send push notification to user about subscription renewal
    try {
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { fcmToken: true, fullName: true },
      });

      if (user?.fcmToken && subscription.subscriptionOffer) {
        const message = `${user.fullName}, your ${subscription.subscriptionOffer.planType} subscription has been renewed automatically!`;
        
        await notificationService
          .sendNotification(
            user.fcmToken,
            'Subscription Renewed',
            message,
            subscription.userId,
          )
          .catch(error =>
            console.error('Error sending subscription renewal webhook notification:', error),
          );
      }
    } catch (error) {
      console.error('Error sending subscription renewal webhook notification:', error);
    }
    
    return updatedSubscription;
  } catch (error) {
    console.error('Error handling renewal notification:', error);
    throw error;
  }
};

/**
 * Handle subscription cancellation
 * User or Apple cancelled the subscription (CANCEL)
 */
const handleCancellationNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing cancellation notification:', notification);

    const { data } = notification;

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        OR: [
          { appleTransactionId: data.transactionId },
          { appleOriginalTransactionId: data.originalTransactionId },
        ],
      },
    });

    if (!subscription) {
      console.warn(
        'Subscription not found for cancellation:',
        data.transactionId,
      );
      return;
    }

    // Update subscription status
    const cancelledSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: PaymentStatus.CANCELLED,
          autoRenew: false,
          cancellationReason: `Apple notification: ${notification.subtype || 'cancelled'}`,
        },
      });

      // Check if user has other active subscriptions
      const otherActive = await tx.userSubscription.findFirst({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          endDate: { gt: new Date() },
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Update user if no active subscriptions
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

    console.log('❌ Subscription cancelled:', cancelledSubscription.id);
    
    // Send push notification to user about subscription cancellation
    try {
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { fcmToken: true, fullName: true },
      });

      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription has been cancelled. You will no longer have access to premium features.`;
        
        await notificationService
          .sendNotification(
            user.fcmToken,
            'Subscription Cancelled',
            message,
            subscription.userId,
          )
          .catch(error =>
            console.error('Error sending subscription cancellation webhook notification:', error),
          );
      }
    } catch (error) {
      console.error('Error sending subscription cancellation webhook notification:', error);
    }
    
    return cancelledSubscription;
  } catch (error) {
    console.error('Error handling cancellation notification:', error);
    throw error;
  }
};

/**
 * Handle expired subscription notification (EXPIRED)
 * Subscription period has ended
 */
const handleExpirationNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing expiration notification:', notification);

    const { data } = notification;

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        OR: [
          { appleTransactionId: data.transactionId },
          { appleOriginalTransactionId: data.originalTransactionId },
        ],
      },
    });

    if (!subscription) {
      console.warn(
        'Subscription not found for expiration:',
        data.transactionId,
      );
      return;
    }

    // Mark as expired if not renewed
    const expiredSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          endDate: new Date(data.expiresDate || Date.now()),
          autoRenew: false,
          paymentStatus: PaymentStatus.EXPIRED,
        },
      });

      // Check if user has other active subscriptions
      const otherActive = await tx.userSubscription.findFirst({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          endDate: { gt: new Date() },
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Update user if this was their active subscription
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

    console.log('⏰ Subscription expired:', expiredSubscription.id);
    
    // Send push notification to user about subscription expiration
    try {
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { fcmToken: true, fullName: true },
      });

      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription has expired. Renew now to continue enjoying premium features!`;
        
        await notificationService
          .sendNotification(
            user.fcmToken,
            'Subscription Expired',
            message,
            subscription.userId,
          )
          .catch(error =>
            console.error('Error sending subscription expiration webhook notification:', error),
          );
      }
    } catch (error) {
      console.error('Error sending subscription expiration webhook notification:', error);
    }
    
    return expiredSubscription;
  } catch (error) {
    console.error('Error handling expiration notification:', error);
    throw error;
  }
};

/**
 * Handle failed renewal notification (DID_FAIL_TO_RENEW)
 * Billing failed, subscription will retry or be cancelled
 */
const handleFailedRenewalNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing failed renewal notification:', notification);

    const { data } = notification;

    // Find subscription
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        OR: [
          { appleTransactionId: data.transactionId },
          { appleOriginalTransactionId: data.originalTransactionId },
        ],
      },
    });

    if (!subscription) {
      console.warn(
        'Subscription not found for failed renewal:',
        data.transactionId,
      );
      return;
    }

    // Update subscription - mark as failed but keep autoRenew true
    // (Apple will retry for grace period)
    const failedSubscription = await prisma.$transaction(async tx => {
      const updated = await tx.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          autoRenew: true, // Apple still retrying
          cancellationReason: 'Billing failed - Apple will retry',
        },
      });

      // Check if we should disable subscription access
      // Option 1: Keep access during grace period
      // Option 2: Disable access immediately
      // We'll disable it to be safe, but keep autoRenew true

      const otherValid = await tx.userSubscription.findFirst({
        where: {
          userId: subscription.userId,
          id: { not: subscription.id },
          endDate: { gt: new Date() },
          paymentStatus: { in: [PaymentStatus.COMPLETED] },
        },
      });

      if (!otherValid) {
        await tx.user.update({
          where: { id: subscription.userId },
          data: {
            isSubscribed: false,
            subscriptionPlan: 'FREE',
          },
        });
      }

      return updated;
    });

    console.log(
      '⚠️ Subscription renewal failed (will retry):',
      failedSubscription.id,
    );
    
    // Send push notification to user about failed renewal
    try {
      const user = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { fcmToken: true, fullName: true },
      });

      if (user?.fcmToken) {
        const message = `${user.fullName}, your subscription renewal failed. Please update your payment method to continue service.`;
        
        await notificationService
          .sendNotification(
            user.fcmToken,
            'Renewal Failed - Action Required',
            message,
            subscription.userId,
          )
          .catch(error =>
            console.error('Error sending failed renewal webhook notification:', error),
          );
      }
    } catch (error) {
      console.error('Error sending failed renewal webhook notification:', error);
    }
    
    return failedSubscription;
  } catch (error) {
    console.error('Error handling failed renewal notification:', error);
    throw error;
  }
};

/**
 * Handle refund notification (REFUND)
 * User requested or Apple issued a refund
 */
const handleRefundNotification = async (
  notification: AppleNotificationPayload,
) => {
  try {
    console.log('Processing refund notification:', notification);

    const { data } = notification;

    // Find related subscription and payments
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        OR: [
          { appleTransactionId: data.transactionId },
          { appleOriginalTransactionId: data.originalTransactionId },
        ],
      },
      include: { subscriptionOffer: true },
    });

    let userId = subscription?.userId;

    // Also find payments for this transaction
    const payments = await prisma.payment.findMany({
      where: {
        appleTransactionId: data.transactionId,
      },
    });

    if (payments.length > 0) {
      userId = payments[0].userId;
    }

    if (!userId && !subscription) {
      console.warn(
        'No subscription or payment found for refund:',
        data.transactionId,
      );
      return;
    }

    // Process refund
    const refundResult = await prisma.$transaction(async tx => {
      const refundedPayments = [];

      // Update payment statuses
      for (const payment of payments) {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });
        refundedPayments.push(updated);
      }

      // If subscription exists, mark it as refunded
      let refundedSubscription = null;
      if (subscription) {
        refundedSubscription = await tx.userSubscription.update({
          where: { id: subscription.id },
          data: {
            paymentStatus: PaymentStatus.REFUNDED,
            autoRenew: false,
            cancellationReason: 'Refunded by Apple',
          },
        });

        // Check if user has other active subscriptions
        const otherActive = await tx.userSubscription.findFirst({
          where: {
            userId: subscription.userId,
            id: { not: subscription.id },
            endDate: { gt: new Date() },
            paymentStatus: PaymentStatus.COMPLETED,
          },
        });

        // Update user if no other active subscriptions
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
      }

      return { refundedPayments, refundedSubscription };
    });

    console.log(
      '💰 Refund processed:',
      refundResult.refundedPayments.length,
      'payments',
    );
    
    // Send push notification to user about refund
    if (subscription) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: subscription.userId },
          select: { fcmToken: true, fullName: true },
        });

        if (user?.fcmToken) {
          const message = `${user.fullName}, a refund of $${subscription.subscriptionOffer?.price || 'N/A'} has been processed for your subscription.`;
          
          await notificationService
            .sendNotification(
              user.fcmToken,
              'Refund Processed',
              message,
              subscription.userId,
            )
            .catch(error =>
              console.error('Error sending refund webhook notification:', error),
            );
        }
      } catch (error) {
        console.error('Error sending refund webhook notification:', error);
      }
    }
    
    return refundResult;
  } catch (error) {
    console.error('Error handling refund notification:', error);
    throw error;
  }
};

/**
 * Main webhook handler - routes notifications to appropriate handlers
 */
export const handleAppleServerNotification = async (
  signedPayload: string,
): Promise<any> => {
  try {
    // Parse and verify the webhook signature
    const notification = (await appleIAPService.parseAppleWebhookNotification(
      signedPayload,
    )) as AppleNotificationPayload;

    console.log(
      '🔔 Received Apple notification:',
      notification.notificationType,
      notification.subtype,
    );

    // Route to appropriate handler based on notification type
    switch (notification.notificationType) {
      // ✅ SUBSCRIBED - User subscribed
      case 'SUBSCRIBED':
        return await handleSubscribedNotification(notification);

      // ✅ DID_RENEW - Subscription renewed successfully
      case 'RENEWAL':
      case 'DID_RENEW':
        return await handleRenewalNotification(notification);

      // ❌ CANCELLED - User cancelled subscription
      case 'CANCELLED':
      case 'CANCEL':
      case 'REVOKE':
        return await handleCancellationNotification(notification);

      // ⏰ EXPIRED - Subscription period ended
      case 'EXPIRED':
      case 'EXPIRATION':
        return await handleExpirationNotification(notification);

      // ⚠️ DID_FAIL_TO_RENEW - Billing failed, will retry
      case 'DID_FAIL_TO_RENEW':
        return await handleFailedRenewalNotification(notification);

      // 💰 REFUND - Apple issued refund
      case 'REFUNDED':
      case 'REFUND':
      case 'GRACE_PERIOD':
        return await handleRefundNotification(notification);

      default:
        console.log(
          'ℹ️ Unhandled notification type:',
          notification.notificationType,
        );
    }

    return {
      success: true,
      message: 'Webhook processed successfully',
    };
  } catch (error) {
    console.error('Error processing Apple webhook:', error);
    // Always return 200 to Apple to acknowledge receipt
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Error processing webhook',
    );
  }
};

export const appleWebhookService = {
  handleAppleServerNotification,
  handleSubscribedNotification,
  handleRenewalNotification,
  handleCancellationNotification,
  handleExpirationNotification,
  handleFailedRenewalNotification,
  handleRefundNotification,
};
