import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { followService } from './follow.service';

const createFollow = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.createFollowIntoDb(user.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Follow created successfully',
    data: result,
  });
});

const getFollowingList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.getFollowingListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Follow list retrieved successfully',
    data: result,
  });
});

const getFollowerList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.getFollowListFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Follow list retrieved successfully',
    data: result,
  });
});

const getFollowById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.getFollowByIdFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Follow details retrieved successfully',
    data: result,
  });
});

const updateFollow = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.updateFollowIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Follow updated successfully',
    data: result,
  });
});

const deleteFollowing = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await followService.deleteFollowingFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Follow deleted successfully',
    data: result,
  });
});

export const followController = {
  createFollow,
  getFollowingList,
  getFollowerList,
  getFollowById,
  updateFollow,
  deleteFollowing,
};