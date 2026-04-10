import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { googleIAPService } from './googleIAP.service';
import { googleWebhookService } from './googleWebhook.service';
import config from '../../../config';

/**
 * Verify Google Play purchase
 * Called by Android app after making a purchase
 * Frontend can send either:
 *   - Short form: { productId: 'silver'|'gold'|'diamond', purchaseToken: 'xxx' }
 *   - Full form: { productId: 'com.barberstime.barber_time_app.monthly', purchaseToken: 'xxx' }
 */
const verifyGooglePlayPurchase = catchAsync(async (req, res) => {
  const { purchaseToken, productId } = req.body;

  // Validate required fields
  if (!purchaseToken || !productId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'purchaseToken and productId are required',
      data: null,
    });
  }

  try {
    // Convert productId to subscriptionId (silver → com.barberstime.barber_time_app.monthly, etc)
    const subscriptionId = googleIAPService.validateSubscriptionId(productId);
    
    // Get packageName from config
    const packageName = config.google?.packageName;
    if (!packageName) {
      return sendResponse(res, {
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'GOOGLE_PACKAGE_NAME not configured',
        data: null,
      });
    }

    const result = await googleIAPService.verifyGooglePlayPurchase(
      packageName,
      subscriptionId,
      purchaseToken,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Google Play purchase verified successfully',
      data: result,
    });
  } catch (error: any) {
    // Enhanced error response with diagnostic info
    const isAuthError = error.message?.includes('credentials') || error.message?.includes('authentication');
    
    sendResponse(res, {
      statusCode: error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      success: false,
      message: error.message,
      ...(isAuthError && {
        errorDetails: {
          hint: 'Ensure GOOGLE_IAP_CREDENTIALS environment variable is set with valid service account JSON',
          credentialsConfigured: !!config.google.packageName,
        }
      }),
    });
  }
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
  try {
    const pubsubMessage = req.body.message;

    if (!pubsubMessage) {
      return sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: 'Invalid Pub/Sub message format',
        data: null,
      });
    }

    console.log('🔔 Google Play Pub/Sub webhook received');

    // Extract project_id from credentials
    let projectId: string | undefined;
    if (config.google?.credentials) {
      try {
        const credentialsObj = typeof config.google.credentials === 'string'
          ? JSON.parse(config.google.credentials)
          : config.google.credentials;
        projectId = credentialsObj.project_id;
      } catch (error) {
        console.warn('⚠️ Failed to extract project_id from credentials:', error);
      }
    }

    // Process the webhook
    const result = await googleWebhookService.handleGooglePlayWebhook(
      pubsubMessage,
      projectId,
    );

    // Always respond with 200 to acknowledge receipt by Pub/Sub
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: result.success,
      message: result.message,
      data: {
        notificationType: result.notificationType,
        processed: true,
      },
    });
  } catch (error: any) {
    console.error('❌ Error in Google Play webhook:', error);

    // Always return 200 to prevent Pub/Sub retries
    // Error is logged for monitoring/alerting
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: false,
      message: 'Webhook received but processing failed',
      data: {
        error: error.message,
        processed: false,
      },
    });
  }
});

export const googleIAPController = {
  verifyGooglePlayPurchase,
  checkSubscriptionStatus,
  getSubscriptionHistory,
  acknowledgePurchase,
  cancelSubscription,
  handleGooglePlayWebhook,
};
