import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { lunchService } from './lunch.service';

const createLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await lunchService.createLunchIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Lunch created successfully',
    data: result,
  });
});

const getLunchList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await lunchService.getLunchListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lunch list retrieved successfully',
    data: result,
  });
});

const getLunchById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await lunchService.getLunchByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lunch details retrieved successfully',
    data: result,
  });
});

const updateLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await lunchService.updateLunchIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lunch updated successfully',
    data: result,
  });
});

const deleteLunch = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await lunchService.deleteLunchItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Lunch deleted successfully',
    data: result,
  });
});

export const lunchController = {
  createLunch,
  getLunchList,
  getLunchById,
  updateLunch,
  deleteLunch,
};