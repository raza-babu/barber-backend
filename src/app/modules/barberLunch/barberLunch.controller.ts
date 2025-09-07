import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { barberLunchService } from './barberLunch.service';
import { SubscriptionPlanStatus } from '@prisma/client';

const createBarberLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to manage barber lunch times.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
  const result = await barberLunchService.createBarberLunchIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'BarberLunch created successfully',
    data: result,
  });
}
});

const getBarberLunchList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to manage barber lunch times.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
  const result = await barberLunchService.getBarberLunchListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberLunch list retrieved successfully',
    data: result,
  });
}
});

const getBarberLunchById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to manage barber holidays.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
  const result = await barberLunchService.getBarberLunchByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberLunch details retrieved successfully',
    data: result,
  });
}
});

const updateBarberLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to manage barber lunch times.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
  const result = await barberLunchService.updateBarberLunchIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberLunch updated successfully',
    data: result,
  });
}
});

const deleteBarberLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const subscriptionPlanName = user.subscriptionPlan;
  if (
    subscriptionPlanName === SubscriptionPlanStatus.FREE ||
    subscriptionPlanName === SubscriptionPlanStatus.ADVANCED_PREMIUM
  ) {
    return sendResponse(res, {
      statusCode: httpStatus.FORBIDDEN,
      success: false,
      message:
        'Access denied. Upgrade your subscription to access to manage barber lunch times.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
  const result = await barberLunchService.deleteBarberLunchItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberLunch deleted successfully',
    data: result,
  });
}
});

export const barberLunchController = {
  createBarberLunch,
  getBarberLunchList,
  getBarberLunchById,
  updateBarberLunch,
  deleteBarberLunch,
};