import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { loyaltySchemeService } from './loyaltyScheme.service';
import { SubscriptionPlanStatus } from '@prisma/client';

const createLoyaltyScheme = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to add loyalty scheme.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await loyaltySchemeService.createLoyaltySchemeIntoDb(
      user.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'LoyaltyScheme created successfully',
      data: result,
    });
  }
});

const getLoyaltySchemeList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to add loyalty scheme.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await loyaltySchemeService.getLoyaltySchemeListFromDb(
      user.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyScheme list retrieved successfully',
      data: result,
    });
  }
});

const getLoyaltySchemeById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to add loyalty scheme.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await loyaltySchemeService.getLoyaltySchemeByIdFromDb(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyScheme details retrieved successfully',
      data: result,
    });
  }
});

const updateLoyaltyScheme = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to add loyalty scheme.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await loyaltySchemeService.updateLoyaltySchemeIntoDb(
      user.id,
      req.params.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyScheme updated successfully',
      data: result,
    });
  }
});

const deleteLoyaltyScheme = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to add loyalty scheme.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await loyaltySchemeService.deleteLoyaltySchemeItemFromDb(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyScheme deleted successfully',
      data: result,
    });
  }
});

export const loyaltySchemeController = {
  createLoyaltyScheme,
  getLoyaltySchemeList,
  getLoyaltySchemeById,
  updateLoyaltyScheme,
  deleteLoyaltyScheme,
};
