import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { barberScheduleService } from './barberSchedule.service';
import { SubscriptionPlanStatus } from '@prisma/client';

const createBarberSchedule = catchAsync(async (req, res) => {
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
        'Access denied. Upgrade your subscription to access to manage barber schedules.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await barberScheduleService.createBarberScheduleIntoDb(user.id, req.body);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'BarberSchedule created successfully',
      data: result,
    });
  }
});

const getBarberScheduleList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberScheduleService.getBarberScheduleListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberSchedule list retrieved successfully',
    data: result,
  });
});

const getBarberScheduleById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await barberScheduleService.getBarberScheduleByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'BarberSchedule details retrieved successfully',
    data: result,
  });
});

const updateBarberSchedule = catchAsync(async (req, res) => {
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
        'Access denied. Upgrade your subscription to access to manage barber schedules.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await barberScheduleService.updateBarberScheduleIntoDb(user.id, req.params.id, req.body);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'BarberSchedule updated successfully',
      data: result,
    });
  }
});

const deleteBarberSchedule = catchAsync(async (req, res) => {
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
        'Access denied. Upgrade your subscription to access to manage barber schedules.',
      data: null,
    });
  }
  if (
    subscriptionPlanName === SubscriptionPlanStatus.BASIC_PREMIUM ||
    SubscriptionPlanStatus.PRO_PREMIUM
  ) {
    const result = await barberScheduleService.deleteBarberScheduleItemFromDb(user.id, req.params.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'BarberSchedule deleted successfully',
      data: result,
    });
  }
});

export const barberScheduleController = {
  createBarberSchedule,
  getBarberScheduleList,
  getBarberScheduleById,
  updateBarberSchedule,
  deleteBarberSchedule,
};