import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { loyaltyProgramService } from './loyaltyProgram.service';
import { SubscriptionPlanStatus } from '@prisma/client';
import { ISearchAndFilterOptions } from '../../interface/pagination.type';

const createLoyaltyProgram = catchAsync(async (req, res) => {
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
    const result = await loyaltyProgramService.createLoyaltyProgramIntoDb(
      user.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'LoyaltyProgram created successfully',
      data: result,
    });
  }
});

const getLoyaltyProgramList = catchAsync(async (req, res) => {
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
    const result = await loyaltyProgramService.getLoyaltyProgramListFromDb(
      user.id,
      req.query as ISearchAndFilterOptions,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyProgram list retrieved successfully',
      data: result.data,
      meta: result.meta,
    });
  }
});

const getLoyaltyProgramById = catchAsync(async (req, res) => {
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
    const result = await loyaltyProgramService.getLoyaltyProgramByIdFromDb(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyProgram details retrieved successfully',
      data: result,
    });
  }
});

const updateLoyaltyProgram = catchAsync(async (req, res) => {
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
    const result = await loyaltyProgramService.updateLoyaltyProgramIntoDb(
      user.id,
      req.params.id,
      req.body,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyProgram updated successfully',
      data: result,
    });
  }
});

const deleteLoyaltyProgram = catchAsync(async (req, res) => {
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
    const result = await loyaltyProgramService.deleteLoyaltyProgramItemFromDb(
      user.id,
      req.params.id,
    );
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'LoyaltyProgram deleted successfully',
      data: result,
    });
  }
});

export const loyaltyProgramController = {
  createLoyaltyProgram,
  getLoyaltyProgramList,
  getLoyaltyProgramById,
  updateLoyaltyProgram,
  deleteLoyaltyProgram,
};
