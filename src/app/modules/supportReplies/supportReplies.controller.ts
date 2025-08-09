import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { supportRepliesService } from './supportReplies.service';

const createSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.createSupportRepliesIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'SupportReplies created successfully',
    data: result,
  });
});

const getSupportRepliesList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.getSupportRepliesListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies list retrieved successfully',
    data: result,
  });
});

const getSupportRepliesById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.getSupportRepliesByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies details retrieved successfully',
    data: result,
  });
});

const updateSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.updateSupportRepliesIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies updated successfully',
    data: result,
  });
});

const deleteSupportReplies = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await supportRepliesService.deleteSupportRepliesItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'SupportReplies deleted successfully',
    data: result,
  });
});

export const supportRepliesController = {
  createSupportReplies,
  getSupportRepliesList,
  getSupportRepliesById,
  updateSupportReplies,
  deleteSupportReplies,
};