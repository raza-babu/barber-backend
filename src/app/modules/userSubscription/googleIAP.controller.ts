import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { googleIAPService } from './googleIAP.service';
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
    const packageName = config.google.packageName;

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
  const packageName = config.google.packageName;

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
  const packageName = config.google.packageName;

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
  const packageName = config.google.packageName;

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
  const packageName = config.google.packageName;

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

export const googleIAPController = {
  verifyGooglePlayPurchase,
  checkSubscriptionStatus,
  getSubscriptionHistory,
  acknowledgePurchase,
  cancelSubscription,
};
