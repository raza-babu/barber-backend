import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { appleIAPService } from './appleIAP.service';
import { appleWebhookService } from './appleWebhook.service';

/**
 * Verify Apple receipt/transaction
 * Called by iOS app after making a purchase
 */
const verifyAppleReceipt = catchAsync(async (req, res) => {
  const { receiptData, productId } = req.body;
  const result = await appleIAPService.verifyAppleReceiptData(receiptData, productId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Apple receipt verified successfully',
    data: result,
  });
});

/**
 * Apple Server-to-Server Notifications webhook
 * Called by Apple servers for subscription events
 */
const handleAppleWebhook = catchAsync(async (req, res) => {
  const { signedPayload } = req.body;

  if (!signedPayload) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'signedPayload is required',
      data: null,
    });
  }

  const result = await appleWebhookService.handleAppleServerNotification(
    signedPayload,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Webhook processed successfully',
    data: result,
  });
});

/**
 * Get subscription status
 * Verify if a subscription is still valid
 */
const checkSubscriptionStatus = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { transactionId, productId } = req.body;

  if (!transactionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'transactionId is required',
      data: null,
    });
  }

  const result = await appleIAPService.verifyAppleReceipt(transactionId, productId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription status retrieved',
    data: result,
  });
});

const getSubscriptionPlans = catchAsync(async (req, res) => {
  const result = await appleIAPService.getAppleSubscriptionPlans();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subscription plans retrieved successfully',
    data: result,
  });
});

/**
 * Get transaction history for restoration
 * Useful for subscription restoration on new devices
 */
const getTransactionHistory = catchAsync(async (req, res) => {
  const { originalTransactionId } = req.body;

  if (!originalTransactionId) {
    return sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'originalTransactionId is required',
      data: null,
    });
  }

  const result = await appleIAPService.getAppleTransactionHistory(
    originalTransactionId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Transaction history retrieved',
    data: result,
  });
});

export const appleIAPController = {
  verifyAppleReceipt,
  handleAppleWebhook,
  getSubscriptionPlans,
  checkSubscriptionStatus,
  getTransactionHistory,
};
