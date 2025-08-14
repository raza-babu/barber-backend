import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { queueCapacityService } from './queueCapacity.service';

const createQueueCapacity = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await queueCapacityService.createQueueCapacityIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'QueueCapacity created successfully',
    data: result,
  });
});

const getQueueCapacityList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await queueCapacityService.getQueueCapacityListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QueueCapacity list retrieved successfully',
    data: result,
  });
});

const getQueueCapacityById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await queueCapacityService.getQueueCapacityByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QueueCapacity details retrieved successfully',
    data: result,
  });
});

const updateQueueCapacity = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await queueCapacityService.updateQueueCapacityIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QueueCapacity updated successfully',
    data: result,
  });
});

const deleteQueueCapacity = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await queueCapacityService.deleteQueueCapacityItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'QueueCapacity deleted successfully',
    data: result,
  });
});

export const queueCapacityController = {
  createQueueCapacity,
  getQueueCapacityList,
  getQueueCapacityById,
  updateQueueCapacity,
  deleteQueueCapacity,
};