import prisma from '../../utils/prisma';
import {
  PaymentStatus,
  Prisma,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import config from '../../../config';
import emailSender from '../../utils/emailSender';
import { appleIAPService } from './appleIAP.service';
import { googleIAPService } from './googleIAP.service';
import jwt from 'jsonwebtoken';
import { notificationService } from '../notification/notification.service';

const extractAppleTransactionMetadata = (
  receiptData?: string,
  verificationResult?: any,
) => {
  const decodedReceipt = receiptData ? (jwt.decode(receiptData) as any) : null;
  const decodedSignedTransactionInfo = verificationResult?.signedTransactionInfo
    ? (jwt.decode(verificationResult.signedTransactionInfo) as any)
    : null;

  return {
    transactionId:
      decodedReceipt?.transactionId ||
      decodedSignedTransactionInfo?.transactionId ||
      verificationResult?.transactionId,
    originalTransactionId:
      decodedReceipt?.originalTransactionId ||
      decodedSignedTransactionInfo?.originalTransactionId ||
      verificationResult?.originalTransactionId,
    productId:
      decodedReceipt?.productId ||
      decodedSignedTransactionInfo?.productId ||
      verificationResult?.productId,
    environment:
      decodedReceipt?.environment ||
      decodedSignedTransactionInfo?.environment ||
      verificationResult?.environment,
  };
};

const createUserSubscriptionIntoDb = async (
  userId: string,
  data: {
    appleTransactionId: string;
    subscriptionOfferId: string;
    productId: string;
    receiptData?: string; // Optional: raw receipt for verification trail
  },
) => {
  // 1. Verify user exists and is active
  const userCheck = await prisma.user.findUnique({
    where: {
      id: userId,
      role: UserRoleEnum.SALOON_OWNER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!userCheck) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');
  }

  // 2. Check for existing active subscription
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      endDate: {
        gt: new Date(),
      },
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  if (existingSubscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An active subscription already exists for this user',
    );
  }

  // 3. Verify Apple receipt/transaction
  let appleTransactionData: any;
  try {
    appleTransactionData = await appleIAPService.verifyAppleReceipt(
      data.appleTransactionId,
      data.productId, // Pass productId for better verification
    );

    console.log('Apple transaction verified:', appleTransactionData);
  } catch (err) {
    console.error('Apple receipt verification failed:', err);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Apple receipt verification failed. Please check your transaction ID.',
    );
  }

  // 4. Fetch subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    select: {
      id: true,
      planType: true,
      price: true,
      durationDays: true,
      creator: { select: { id: true } },
    },
  });

  if (!subscriptionOffer) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer not found',
    );
  }

  // 5. Check user is not subscribing to their own plan
  if (subscriptionOffer.creator.id === userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot subscribe to your own subscription plan',
    );
  }

  // 6. Database transaction for subscription creation
  const result = await prisma.$transaction(
    async tx => {
      const startDate = new Date();
      const durationDays = subscriptionOffer.durationDays || 30;
      const endDate = new Date(
        startDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
      );
      const appleMetadata = extractAppleTransactionMetadata(
        data.receiptData,
        appleTransactionData,
      );
      const appleAuditData = JSON.stringify({
        receiptData: data.receiptData || null,
        appleTransactionData,
        appleMetadata,
      });

      // Create user subscription record
      const createdSubscription = await tx.userSubscription.create({
        data: {
          userId: userCheck.id,
          subscriptionOfferId: subscriptionOffer.id,
          startDate: startDate,
          endDate: endDate,
          appleTransactionId: data.appleTransactionId,
          appleProductId: appleMetadata.productId || data.productId,
          appleOriginalTransactionId: appleMetadata.originalTransactionId,
          appleReceiptData: appleAuditData,
          autoRenew: true,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Record payment
      await tx.payment.create({
        data: {
          userId: userId,
          appleTransactionId: data.appleTransactionId,
          appleProductId: appleMetadata.productId || data.productId,
          appleReceiptData: appleAuditData,
          paymentAmount: subscriptionOffer.price,
          status: PaymentStatus.COMPLETED,
        },
      });

      // Update user profile
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
          subscriptionPlan: subscriptionOffer.planType,
        },
      });

      return {
        ...createdSubscription,
        subscriptionOffer: subscriptionOffer,
      };
    },
    {
      timeout: 10000,
    },
  );

  // 7. Send confirmation email
  try {
    await emailSender(
      'Your Subscription is Active',
      userCheck.email!,
      `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 10px;
            padding: 10px;
            background-color: #f9f9f9;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 20px;
            text-align: center;
            color: white;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #2d3748;
        }
        .message {
            margin-bottom: 25px;
            font-size: 16px;
            color: #4a5568;
        }
        .details-section {
            background-color: #f7fafc;
            padding: 20px;
            border-radius: 6px;
            border-left: 4px solid #667eea;
            margin: 25px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        .detail-label {
            font-weight: bold;
            color: #2d3748;
        }
        .detail-value {
            color: #4a5568;
        }
        .support {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #718096;
        }
        .footer {
            background-color: #edf2f7;
            padding: 20px;
            text-align: center;
            font-size: 14px;
            color: #718096;
        }
        .signature {
            margin-top: 25px;
            color: #2d3748;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✂️ Barber Shift App</div>
            <h1>Subscription Activated</h1>
        </div>
        
        <div class="content">
            <div class="greeting">Dear ${userCheck.fullName},</div>
            
            <div class="message">
                Thank you for subscribing! Your subscription is now active and you can start enjoying all the premium features immediately.
            </div>

            <div class="details-section">
                <div class="detail-row">
                    <span class="detail-label">Plan:</span>
                    <span class="detail-value">${subscriptionOffer.planType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Price:</span>
                    <span class="detail-value">$${subscriptionOffer.price}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Start Date:</span>
                    <span class="detail-value">${new Date().toLocaleDateString()}</span>
                </div>
                <div class="detail-row" style="border-bottom: none;">
                    <span class="detail-label">Renewal Date:</span>
                    <span class="detail-value">${new Date(Date.now() + (subscriptionOffer.durationDays || 30) * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                </div>
            </div>

            <div class="message">
                <strong>What's next?</strong><br>
                • Access your premium features immediately<br>
                • Manage your subscription from your account settings<br>
                • Automatic renewal will occur on your renewal date
            </div>

            <div class="support">
                <strong>Need Help?</strong><br>
                If you have any questions or need assistance, our support team is here to help!<br>
                📧 Email: support@barbershiftapp.com<br>
                ⏰ Hours: Monday-Friday, 9AM-6PM
            </div>

            <div class="signature">
                Best regards,<br>
                <strong>The Barber Shift App Team</strong>
            </div>
        </div>

        <div class="footer">
            <p>©${new Date().getFullYear()} Barber Shift App. All rights reserved.</p>
            <p>You're receiving this email because you recently subscribed to our service.</p>
        </div>
    </div>
</body>
            </html>`,
    );
  } catch (emailError) {
    console.log('Email notification failed:', emailError);
    // Don't fail the subscription creation if email fails
  }

  // Send push notification to user about subscription activation
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, fullName: true },
    });

    if (subscriber?.fcmToken) {
      const message = `${subscriber.fullName}, your ${subscriptionOffer.planType} subscription is now active! Enjoy all premium features.`;
      
      await notificationService
        .sendNotification(
          subscriber.fcmToken,
          'Subscription Activated',
          message,
          userId,
        )
        .catch(error =>
          console.error('Error sending subscription activation notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending subscription activation notification:', error);
  }

  return result;
};

const getOwnerSubscriptionPlanFromDb = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionPlan: true,
      isSubscribed: true,
      subscriptionEnd: true,
      stripeSubscriptionId: true,
      SaloonOwner: {
        select: {
          shopName: true,
          shopLogo: true,
          userId: true,
          isVerified: true,
        },
      },
      UserSubscription: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
        },
        where: { paymentStatus: PaymentStatus.COMPLETED },
      }
    },
  });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return user;
};

const getUserSubscriptionListFromDb = async (userId: string) => {
  const result = await prisma.userSubscription.findMany({
    include: {
      subscriptionOffer: true,
    },
  });
  if (result.length === 0) {
    return { message: 'No userSubscription found' };
  }
  return result.map(item => ({
    ...item,
    subscriptionOffer: item.subscriptionOffer,
  }));
};

const getUserSubscriptionByIdFromDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.userSubscription.findUnique({
    where: {
      id: userSubscriptionId,
    },
    include: {
      subscriptionOffer: true,
    },
  });
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'userSubscription not found');
  }
  return {
    ...result,
    subscriptionOffer: result.subscriptionOffer,
  };
};

const updateUserSubscriptionIntoDb = async (
  userId: string,
  userSubscriptionId: string,
  data: {
    appleTransactionId: string;
    subscriptionOfferId: string;
    receiptData?: string;
    productId: string;
  },
) => {
  // Step 1: Find existing subscription
  const existing = await prisma.userSubscription.findFirst({
    where: {
      id: userSubscriptionId,
      userId,
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
  }

  // Optional: Check if subscription is still within renewal window
  if (existing.endDate > new Date()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription is still active. Can only renew after expiration or near expiration date.',
    );
  }

  // Step 2: Verify new Apple transaction
  let appleTransactionData: any;
  try {
    appleTransactionData = await appleIAPService.verifyAppleReceipt(
      data.appleTransactionId,
      data.productId, // Pass productId for better verification
    );
    console.log('Apple renewal transaction verified:', appleTransactionData);
  } catch (err) {
    console.error('Apple receipt verification failed:', err);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Apple receipt verification failed.',
    );
  }

  // Step 3: Get subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    select: {
      id: true,
      planType: true,
      price: true,
      durationDays: true,
    },
  });

  if (!subscriptionOffer) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer not found',
    );
  }

  // Step 4: Update in database transaction
  const result = await prisma.$transaction(
    async tx => {
      const startDate = new Date();
      const durationDays = subscriptionOffer.durationDays || 30;
      const endDate = new Date(
        startDate.getTime() + durationDays * 24 * 60 * 60 * 1000,
      );
      const appleMetadata = extractAppleTransactionMetadata(
        data.receiptData,
        appleTransactionData,
      );
      const appleAuditData = JSON.stringify({
        receiptData: data.receiptData || null,
        appleTransactionData,
        appleMetadata,
      });

      // Update user subscription
      const updatedSubscription = await tx.userSubscription.update({
        where: { id: userSubscriptionId },
        data: {
          subscriptionOfferId: data.subscriptionOfferId,
          startDate: startDate,
          endDate: endDate,
          appleTransactionId: data.appleTransactionId,
          appleProductId: appleMetadata.productId || data.productId,
          appleOriginalTransactionId: appleMetadata.originalTransactionId,
          appleReceiptData: appleAuditData,
          paymentStatus: PaymentStatus.COMPLETED,
        },
      });

      // Record renewal payment
      await tx.payment.create({
        data: {
          userId: userId,
          appleTransactionId: data.appleTransactionId,
          appleProductId: appleMetadata.productId || data.productId,
          appleReceiptData: appleAuditData,
          paymentAmount: subscriptionOffer.price,
          status: PaymentStatus.COMPLETED,
        },
      });

      // Update user
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user) {
        await tx.user.update({
          where: { id: userId },
          data: {
            isSubscribed: true,
            subscriptionEnd: endDate,
          },
        });
      }

      return {
        ...updatedSubscription,
        subscriptionOffer: subscriptionOffer,
      };
    },
    {
      timeout: 10000,
    },
  );

  // Send push notification to user about subscription renewal
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, fullName: true },
    });

    if (subscriber?.fcmToken) {
      const message = `${subscriber.fullName}, your ${subscriptionOffer.planType} subscription has been renewed successfully!`;
      
      await notificationService
        .sendNotification(
          subscriber.fcmToken,
          'Subscription Renewed',
          message,
          userId,
        )
        .catch(error =>
          console.error('Error sending subscription renewal notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending subscription renewal notification:', error);
  }

  return result;
};

const cancelAutomaticRenewalIntoDb = async (
  userId: string,
  userSubscriptionId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Find subscription
    const existing = await tx.userSubscription.findFirst({
      where: {
        id: userSubscriptionId,
        userId: userId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // For Apple IAP, we mark autoRenew as false
    // Apple handles the actual cancellation through the App Store
    const updatedSubscription = await tx.userSubscription.update({
      where: { id: userSubscriptionId },
      data: {
        autoRenew: false,
        cancellationReason: 'User cancelled automatic renewal',
        paymentStatus: PaymentStatus.CANCELLED,
      },
    });

    return {
      message: 'Automatic renewal has been cancelled. Your subscription will expire on ' + existing.endDate.toLocaleDateString(),
      subscription: updatedSubscription,
    };
  });

  // Send push notification to user about automatic renewal cancellation
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, fullName: true },
    });

    if (subscriber?.fcmToken) {
      const expireDate = result.subscription.endDate.toLocaleDateString();
      const message = `${subscriber.fullName}, automatic renewal is now disabled. Your subscription will expire on ${expireDate}.`;
      
      await notificationService
        .sendNotification(
          subscriber.fcmToken,
          'Automatic Renewal Cancelled',
          message,
          userId,
        )
        .catch(error =>
          console.error('Error sending renewal cancellation notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending renewal cancellation notification:', error);
  }

  return result;
};

const deleteCustomerSubscriptionItemFromDb = async (
  adminUserId: string,
  saloonOwnerId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Find subscription for the customer
    const existing = await tx.userSubscription.findFirst({
      where: {
        userId: saloonOwnerId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Immediately cancel the subscription in the database
    const updatedSubscription = await tx.userSubscription.update({
      where: { id: existing.id },
      data: {
        endDate: new Date(),
        autoRenew: false,
        paymentStatus: PaymentStatus.CANCELLED,
        cancellationReason: 'Admin cancelled subscription',
      },
    });

    // Update related payments
    await tx.payment.updateMany({
      where: {
        userId: saloonOwnerId,
        status: PaymentStatus.COMPLETED,
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });

    // Update user status
    await tx.user.update({
      where: { id: saloonOwnerId },
      data: {
        isSubscribed: false,
        subscriptionEnd: new Date(),
      },
    });

    return {
      message: 'Subscription cancelled successfully',
      saloonOwnerId: saloonOwnerId,
    };
  });

  // Send push notification to salon owner about subscription cancellation
  try {
    const owner = await prisma.user.findUnique({
      where: { id: saloonOwnerId },
      select: { fcmToken: true, fullName: true },
    });

    if (owner?.fcmToken) {
      const message = `${owner.fullName}, your subscription has been cancelled by an administrator. Your premium access is now revoked.`;
      
      await notificationService
        .sendNotification(
          owner.fcmToken,
          'Subscription Cancelled',
          message,
          saloonOwnerId,
        )
        .catch(error =>
          console.error('Error sending admin cancellation notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending admin cancellation notification:', error);
  }

  return result;
};

const deleteUserSubscriptionItemFromDb = async (
  userId: string,
  subscriptionOfferId: string,
) => {
  const result = await prisma.$transaction(async tx => {
    // Find subscription
    const existing = await tx.userSubscription.findFirst({
      where: {
        subscriptionOfferId: subscriptionOfferId,
        userId: userId,
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    if (!existing) {
      throw new AppError(httpStatus.NOT_FOUND, 'Subscription not found');
    }

    // Cancel subscription immediately
    const updatedSubscription = await tx.userSubscription.update({
      where: { id: existing.id },
      data: {
        endDate: new Date(),
        autoRenew: false,
        paymentStatus: PaymentStatus.CANCELLED,
        cancellationReason: 'User cancelled subscription',
      },
    });

    // Cancel related payments
    await tx.payment.updateMany({
      where: {
        userId: userId,
        status: PaymentStatus.COMPLETED,
      },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });

    // Check if user has other active subscriptions
    const otherActiveSubscriptions = await tx.userSubscription.findFirst({
      where: {
        userId: userId,
        id: { not: existing.id },
        endDate: { gt: new Date() },
        paymentStatus: PaymentStatus.COMPLETED,
      },
    });

    // Update user status if no active subscriptions remain
    if (!otherActiveSubscriptions) {
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: false,
          subscriptionEnd: null,
        },
      });
    }

    return {
      message: 'Subscription cancelled successfully (no refund issued)',
      cancelledSubscriptionId: existing.id,
    };
  });

  // Send push notification to user about subscription cancellation
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, fullName: true },
    });

    if (subscriber?.fcmToken) {
      const message = `${subscriber.fullName}, your subscription has been cancelled. You will lose access to premium features.`;
      
      await notificationService
        .sendNotification(
          subscriber.fcmToken,
          'Subscription Cancelled',
          message,
          userId,
        )
        .catch(error =>
          console.error('Error sending user cancellation notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending user cancellation notification:', error);
  }

  return result;
};

/**
 * Create Google Play subscription
 * Handles Google Play purchase verification and subscription creation
 */
const createGooglePlaySubscriptionIntoDb = async (
  userId: string,
  data: {
    packageName: string;
    purchaseToken: string;
    subscriptionId: string;
    subscriptionOfferId: string;
    productId: string; // Plan type: silver, gold, diamond
    platform: string;
  },
) => {
  // 1. Verify user exists and is active
  const userCheck = await prisma.user.findUnique({
    where: {
      id: userId,
      role: UserRoleEnum.SALOON_OWNER,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
    },
  });

  if (!userCheck) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found or inactive');
  }

  // 2. Check for existing active subscription
  const existingSubscription = await prisma.userSubscription.findFirst({
    where: {
      userId: userId,
      endDate: {
        gt: new Date(),
      },
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });

  if (existingSubscription) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An active subscription already exists for this user',
    );
  }

  // 3. Validate subscription ID format
  const googleSubscriptionId = googleIAPService.validateSubscriptionId(data.productId);

  // 4. Verify Google Play purchase/subscription
  let googlePurchaseData: any;
  try {
    googlePurchaseData = await googleIAPService.verifyGooglePlayPurchase(
      data.packageName,
      googleSubscriptionId,
      data.purchaseToken,
    );

    console.log('Google Play subscription verified:', {
      orderId: googlePurchaseData.orderId,
      autoRenewing: googlePurchaseData.autoRenewing,
      expiryDate: googlePurchaseData.expiryDate,
    });

    // Acknowledge the purchase to prevent cancellation
    await googleIAPService.acknowledgePurchase(
      data.packageName,
      googleSubscriptionId,
      data.purchaseToken,
    );
  } catch (err) {
    console.error('Google Play purchase verification failed:', err);
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Google Play purchase verification failed. Please verify your purchase token.',
    );
  }

  // 5. Fetch subscription offer
  const subscriptionOffer = await prisma.subscriptionOffer.findUnique({
    where: { id: data.subscriptionOfferId },
    select: {
      id: true,
      planType: true,
      price: true,
      durationDays: true,
      creator: { select: { id: true } },
    },
  });

  if (!subscriptionOffer) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Subscription offer not found',
    );
  }

  // 6. Check user is not subscribing to their own plan
  if (subscriptionOffer.creator.id === userId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You cannot subscribe to your own subscription plan',
    );
  }

  // 7. Database transaction for subscription creation
  const result = await prisma.$transaction(
    async tx => {
      const startDate = new Date(parseInt(googlePurchaseData.startTimeMillis));
      const endDate = new Date(parseInt(googlePurchaseData.expiryTimeMillis));

      // Create user subscription record
      const createdSubscription = await tx.userSubscription.create({
        data: {
          userId: userCheck.id,
          subscriptionOfferId: subscriptionOffer.id,
          startDate: startDate,
          endDate: endDate,
          // Google Play specific fields
          googleTransactionId: data.purchaseToken, // Purchase token from Google Play
          googleProductId: googleSubscriptionId,   // Full subscription ID (com.barberstime.barber_time_app.monthly)
          googleOrderId: googlePurchaseData.orderId,
          googleReceiptData: JSON.stringify({
            platform: data.platform,
            packageName: data.packageName,
            subscriptionId: googleSubscriptionId,
            purchaseToken: data.purchaseToken,
            orderId: googlePurchaseData.orderId,
          }),
          autoRenew: googlePurchaseData.autoRenewing || true,
          paymentStatus: PaymentStatus.COMPLETED,
          platform: 'google', // Explicitly set platform to google
        },
      });

      // Record payment
      await tx.payment.create({
        data: {
          userId: userId,
          googleTransactionId: data.purchaseToken,
          googleOrderId: googlePurchaseData.orderId,
          googleProductId: googleSubscriptionId,
          googleReceiptData: JSON.stringify(googlePurchaseData),
          paymentAmount: subscriptionOffer.price,
          status: PaymentStatus.COMPLETED,
        },
      });

      // Update user profile
      await tx.user.update({
        where: { id: userId },
        data: {
          isSubscribed: true,
          subscriptionEnd: endDate,
          subscriptionPlan: subscriptionOffer.planType,
        },
      });

      return {
        ...createdSubscription,
        subscriptionOffer: subscriptionOffer,
      };
    },
    {
      timeout: 10000,
    },
  );

  // 8. Send confirmation email
  try {
    // Email notification logic (similar to Apple IAP)
    console.log(`📧 Sending subscription confirmation email to ${userCheck.email}`);
  } catch (emailError) {
    console.error('Email sending failed:', emailError);
    // Continue despite email error
  }

  // Send push notification to user about Google Play subscription activation
  try {
    const subscriber = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, fullName: true },
    });

    if (subscriber?.fcmToken) {
      const message = `${subscriber.fullName}, your ${subscriptionOffer.planType} subscription is now active! Enjoy all premium features.`;
      
      await notificationService
        .sendNotification(
          subscriber.fcmToken,
          'Subscription Activated',
          message,
          userId,
        )
        .catch(error =>
          console.error('Error sending Google Play subscription activation notification:', error),
        );
    }
  } catch (error) {
    console.error('Error sending Google Play subscription activation notification:', error);
  }

  return result;
};

export const userSubscriptionService = {
  createUserSubscriptionIntoDb,
  createGooglePlaySubscriptionIntoDb,
  getUserSubscriptionListFromDb,
  getOwnerSubscriptionPlanFromDb,
  getUserSubscriptionByIdFromDb,
  updateUserSubscriptionIntoDb,
  cancelAutomaticRenewalIntoDb,
  deleteUserSubscriptionItemFromDb,
  deleteCustomerSubscriptionItemFromDb,
};
