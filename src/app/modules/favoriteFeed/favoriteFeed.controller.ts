import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { favoriteFeedService } from './favoriteFeed.service';

const createFavoriteFeed = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteFeedService.createFavoriteFeedIntoDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'FavoriteFeed created successfully',
    data: result,
  });
});

const getFavoriteFeedList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteFeedService.getFavoriteFeedListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteFeed list retrieved successfully',
    data: result,
  });
});

const getFavoriteFeedById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteFeedService.getFavoriteFeedByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteFeed details retrieved successfully',
    data: result,
  });
});

const updateFavoriteFeed = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteFeedService.updateFavoriteFeedIntoDb(user.id, req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteFeed updated successfully',
    data: result,
  });
});

const deleteFavoriteFeed = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await favoriteFeedService.deleteFavoriteFeedItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'FavoriteFeed deleted successfully',
    data: result,
  });
});

export const favoriteFeedController = {
  createFavoriteFeed,
  getFavoriteFeedList,
  getFavoriteFeedById,
  updateFavoriteFeed,
  deleteFavoriteFeed,
};