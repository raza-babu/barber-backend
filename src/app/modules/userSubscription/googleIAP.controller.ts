import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { googleIAPService } from './googleIAP.service';
import { googleWebhookService } from './googleWebhook.service';
import config from '../../../config';
import { userSubscriptionService } from './userSubscription.service';
import { TVerifyAppReceiptPayloadType } from './userSubscription.validation';

/**
 * Verify Google Play purchase
 * Called by Android app after making a purchase
 * Frontend can send either:
 *   - Short form: { productId: 'silver'|'gold'|'diamond', purchaseToken: 'xxx' }
 *   - Full form: { productId: 'com.barberstime.barber_time_app.monthly', purchaseToken: 'xxx' }
 */
/**
 * Verify Google Play purchase, acknowledge it, and create the subscription record.
 * This is the single source of truth for initial subscription creation.
 */
const verifyGooglePlayPurchase = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { purchaseToken, productId, subscriptionOfferId, platform } =
    req.body as TVerifyAppReceiptPayloadType;

  console.log('verifyGooglePlayPurchase', verifyGooglePlayPurchase);

  const packageName = config.google?.packageName;
  if (!packageName) {
    return sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'GOOGLE_PACKAGE_NAME not configured',
      data: null,
    });
  }

  const subscriptionId = googleIAPService.validateSubscriptionId(productId);

  // Step 1: Verify the purchase with Google Play API
  await googleIAPService.verifyGooglePlayPurchase(packageName, purchaseToken);

  // Step 2: Acknowledge the purchase so Google doesn't auto-refund
  await googleIAPService.acknowledgePurchase(
    packageName,
    subscriptionId,
    purchaseToken,
  );

  // Step 3: Create the subscription record in DB.
  // This must complete before any webhook tries to update it.
  const result =
    await userSubscriptionService.createGooglePlaySubscriptionIntoDb(user?.id, {
      packageName,
      purchaseToken,
      subscriptionId,
      subscriptionOfferId,
      productId,
      platform,
    });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Google Play purchase verified successfully',
    data: result,
  });
});

/**
 * Check current subscription status
 * Verify if a subscription is still valid
 */
const checkSubscriptionStatus = catchAsync(async (req, res) => {
  const { purchaseToken, productId } = req.body;

  if (!purchaseToken || !productId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'purchaseToken and productId are required',
      data: null,
    });
  }

  const subscriptionId = googleIAPService.validateSubscriptionId(productId);
  const packageName = config.google?.packageName;
  if (!packageName) {
    return sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'GOOGLE_PACKAGE_NAME not configured',
      data: null,
    });
  }

  const result = await googleIAPService.checkSubscriptionStatus(
    packageName,
    subscriptionId,
    purchaseToken,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription status retrieved successfully',
    data: result,
  });
});

/**
 * Get subscription purchase history
 * Useful for subscription restoration on new devices
 */
const getSubscriptionHistory = catchAsync(async (req, res) => {
  const { purchaseToken, productId } = req.body;

  if (!purchaseToken || !productId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'purchaseToken and productId are required',
      data: null,
    });
  }

  const subscriptionId = googleIAPService.validateSubscriptionId(productId);
  const packageName = config.google?.packageName;
  if (!packageName) {
    return sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'GOOGLE_PACKAGE_NAME not configured',
      data: null,
    });
  }

  const result = await googleIAPService.getSubscriptionPurchaseHistory(
    packageName,
    subscriptionId,
    purchaseToken,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription history retrieved successfully',
    data: result,
  });
});

/**
 * Acknowledge a purchase
 * Required for new purchases to prevent pending expiration
 */
const acknowledgePurchase = catchAsync(async (req, res) => {
  const { purchaseToken, productId } = req.body;

  if (!purchaseToken || !productId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'purchaseToken and productId are required',
      data: null,
    });
  }

  const subscriptionId = googleIAPService.validateSubscriptionId(productId);
  const packageName = config.google?.packageName;
  if (!packageName) {
    return sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'GOOGLE_PACKAGE_NAME not configured',
      data: null,
    });
  }

  await googleIAPService.acknowledgePurchase(
    packageName,
    subscriptionId,
    purchaseToken,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Purchase acknowledged successfully',
    data: null,
  });
});

/**
 * Cancel a subscription
 */
const cancelSubscription = catchAsync(async (req, res) => {
  const { purchaseToken, productId } = req.body;

  if (!purchaseToken || !productId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'purchaseToken and productId are required',
      data: null,
    });
  }

  const subscriptionId = googleIAPService.validateSubscriptionId(productId);
  const packageName = config.google?.packageName;
  if (!packageName) {
    return sendResponse(res, {
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: 'GOOGLE_PACKAGE_NAME not configured',
      data: null,
    });
  }

  await googleIAPService.cancelSubscription(
    packageName,
    subscriptionId,
    purchaseToken,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription cancelled successfully',
    data: null,
  });
});

/**
 * Handle Google Play Pub/Sub webhook
 * Receives real-time subscription events from Google Play
 * IMPORTANT: This endpoint does NOT require authentication as it's called by Google Pub/Sub
 */
const handleGooglePlayWebhook = catchAsync(async (req, res) => {
  const pubsubMessage = req.body.message;

  if (!pubsubMessage) {
    // Still return 200 to acknowledge receipt
    return sendResponse(res, {
      statusCode: httpStatus.OK,
      success: false,
      message: 'Invalid Pub/Sub message format',
      data: null,
    });
  }

  let projectId: string | undefined;
  if (config.google?.credentials) {
    try {
      const creds =
        typeof config.google.credentials === 'string'
          ? JSON.parse(config.google.credentials)
          : config.google.credentials;
      projectId = creds.project_id;
    } catch {
      // Non-fatal
    }
  }

  const result = await googleWebhookService.handleGooglePlayWebhook(
    pubsubMessage,
    projectId,
  );

  // Always 200 — Google Pub/Sub must not retry
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: result.success,
    message: result.message,
    data: { notificationType: result.notificationType, processed: true },
  });
});

export const googleIAPController = {
  verifyGooglePlayPurchase,
  checkSubscriptionStatus,
  getSubscriptionHistory,
  acknowledgePurchase,
  cancelSubscription,
  handleGooglePlayWebhook,
};
