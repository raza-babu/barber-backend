import httpStatus from 'http-status';
import sendResponse from '../../utils/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { feedService } from './feed.service';
import { uploadFileToS3 } from '../../utils/multipleFile';

const createFeed = catchAsync(async (req, res) => {
  const user = req.user as any;

  const {files, body} = req;

  const uploads: {
    images: string[];
  } = {
    images: [],
  };
  const fileGroups = files as {
    images?: Express.Multer.File[];
  };
  // Upload images
  if (fileGroups.images?.length) {
    const imageUploads = await Promise.all(
      fileGroups.images.map(file => uploadFileToS3(file, 'feed-images'))
    );
    uploads.images.push(...imageUploads);
  }

  const feedData = {
    ...body,
    images: uploads.images,
  };

  const result = await feedService.createFeedIntoDb(user.id, feedData);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Feed created successfully',
    data: result,
  });
});

const getFeedList = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { page, limit } = req.query;
  const result = await feedService.getFeedListFromDb(user.id, Number(page), Number(limit));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Feed list retrieved successfully',
    data: result.items,
    meta: {
      page: result.meta.page,
      limit: result.meta.limit,
      total: result.meta.total,
      totalPages: result.meta.totalPages,
    } as any,
  });
});

const getMyFeeds = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await feedService.getMyFeedsFromDb(user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My feeds retrieved successfully',
    data: result,
  });
});

const getFeedById = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await feedService.getFeedByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Feed details retrieved successfully',
    data: result,
  });
});

const updateFeed = catchAsync(async (req, res) => {
  const user = req.user as any;
  const { files, body } = req;

  const fileGroups = files as { images?: Express.Multer.File[] };

  // Existing images array sent from client
  const existingImages: string[] = body.existingImages || [];

  // Upload new images
  let newUploads: string[] = [];
  if (fileGroups.images?.length) {
    newUploads = await Promise.all(
      fileGroups.images.map(file => uploadFileToS3(file, "feed-images"))
    );
  }

  // Merge existing + new images
  const finalImages = [...existingImages, ...newUploads];

  const feedData = {
    ...body,
    images: finalImages,
  };

  const result = await feedService.updateFeedIntoDb(
    user.id,
    req.params.id,
    feedData,
    existingImages // pass to service to check removed images
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Feed updated successfully",
    data: result,
  });
});


const deleteFeed = catchAsync(async (req, res) => {
  const user = req.user as any;
  const result = await feedService.deleteFeedItemFromDb(user.id, req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Feed deleted successfully',
    data: result,
  });
});

export const feedController = {
  createFeed,
  getFeedList,
  getMyFeeds,
  getFeedById,
  updateFeed,
  deleteFeed,
};