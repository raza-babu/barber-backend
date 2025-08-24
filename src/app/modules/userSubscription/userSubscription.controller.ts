import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { userSubscriptionService } from './userSubscription.service';

const createUserSubscription = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await userSubscriptionService.createUserSubscriptionIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'UserSubscription created successfully',
    data: result,
  });
});

const getUserSubscriptionList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await userSubscriptionService.getUserSubscriptionListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'UserSubscription list retrieved successfully',
    data: result,
  });
});

const getUserSubscriptionById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await userSubscriptionService.getUserSubscriptionByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'UserSubscription details retrieved successfully',
    data: result,
  });
});

const updateUserSubscription = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await userSubscriptionService.updateUserSubscriptionIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'UserSubscription updated successfully',
    data: result,
  });
});

const deleteUserSubscription = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await userSubscriptionService.deleteUserSubscriptionItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'UserSubscription deleted successfully',
    data: result,
  });
});

export const userSubscriptionController = {
  createUserSubscription,
  getUserSubscriptionList,
  getUserSubscriptionById,
  updateUserSubscription,
  deleteUserSubscription,
};