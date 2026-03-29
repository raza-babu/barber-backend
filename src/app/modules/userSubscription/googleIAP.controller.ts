import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { googleIAPService } from './googleIAP.service';

/**
 * Verify Google Play purchase
 * Called by Android app after making a purchase
 */
const verifyGooglePlayPurchase = catchAsync(async (req, res) => {
  const { packageName, purchaseToken, subscriptionId } = req.body;

  // Validate required fields
  if (!packageName || !purchaseToken || !subscriptionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'packageName, purchaseToken, and subscriptionId are required',
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
});

/**
 * Check current subscription status
 * Verify if a subscription is still valid
 */
const checkSubscriptionStatus = catchAsync(async (req, res) => {
  const { packageName, purchaseToken, subscriptionId } = req.body;

  if (!packageName || !purchaseToken || !subscriptionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'packageName, purchaseToken, and subscriptionId are required',
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
  const { packageName, purchaseToken, subscriptionId } = req.body;

  if (!packageName || !purchaseToken || !subscriptionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'packageName, purchaseToken, and subscriptionId are required',
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
  const { packageName, purchaseToken, subscriptionId } = req.body;

  if (!packageName || !purchaseToken || !subscriptionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'packageName, purchaseToken, and subscriptionId are required',
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
  const { packageName, purchaseToken, subscriptionId } = req.body;

  if (!packageName || !purchaseToken || !subscriptionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'packageName, purchaseToken, and subscriptionId are required',
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

export const googleIAPController = {
  verifyGooglePlayPurchase,
  checkSubscriptionStatus,
  getSubscriptionHistory,
  acknowledgePurchase,
  cancelSubscription,
};
